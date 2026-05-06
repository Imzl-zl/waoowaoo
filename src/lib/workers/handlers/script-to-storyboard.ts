import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import {
  getUserWorkflowConcurrencyConfig,
  resolveProjectModelCapabilityGenerationOptions,
} from '@/lib/config-service'
import { onProjectNameAvailable } from '@/lib/logging/file-writer'
import { TaskTerminatedError } from '@/lib/task/errors'
import {
  buildTaskExecutionContextFromJob,
  reportTaskProgressContext,
  type TaskExecutionContext,
} from '@/lib/workers/shared'
import {
  type ScriptToStoryboardOrchestratorResult,
} from '@/lib/novel-promotion/script-to-storyboard/orchestrator'
import {
  createWorkerLLMStreamCallbacksContext,
  createWorkerLLMStreamContextForTask,
} from './llm-stream'
import type { TaskJobData } from '@/lib/task/types'
import { parseEffort, parseTemperature } from './script-to-storyboard-helpers'
import { resolveAnalysisModel } from './resolve-analysis-model'
import { assertWorkflowRunActive, withWorkflowRunLease } from '@/lib/run-runtime/workflow-lease'
import {
  parseStoryboardRetryTarget,
} from './script-to-storyboard-atomic-retry'
import {
  buildStoryboardClipInput,
  buildStoryboardNovelAssets,
  buildWorkflowWorkerId,
  createScriptToStoryboardRunStep,
  getStoryboardPromptTemplates,
  isReasoningEffort,
  type AnyObj,
} from './script-to-storyboard-task-helpers'
import {
  persistStoryboardTaskOutputs,
  runStoryboardOrchestratorFlow,
} from './script-to-storyboard-pipeline'

export async function handleScriptToStoryboardTask(job: Job<TaskJobData>) {
  return await handleScriptToStoryboardTaskContext(buildTaskExecutionContextFromJob(job))
}

export async function handleScriptToStoryboardTaskContext(context: TaskExecutionContext) {
  const data = context.data
  const payload = (data.payload || {}) as AnyObj
  const projectId = data.projectId
  const episodeIdRaw = typeof payload.episodeId === 'string' ? payload.episodeId : (data.episodeId || '')
  const episodeId = episodeIdRaw.trim()
  const inputModel = typeof payload.model === 'string' ? payload.model.trim() : ''
  const retryStepKey = typeof payload.retryStepKey === 'string' ? payload.retryStepKey.trim() : ''
  const retryStepAttempt = typeof payload.retryStepAttempt === 'number' && Number.isFinite(payload.retryStepAttempt)
    ? Math.max(1, Math.floor(payload.retryStepAttempt))
    : 1
  const reasoning = payload.reasoning !== false
  const requestedReasoningEffort = parseEffort(payload.reasoningEffort)
  const temperature = parseTemperature(payload.temperature)

  if (!episodeId) {
    throw new Error('episodeId is required')
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
    },
  })
  if (!project) {
    throw new Error('Project not found')
  }

  // Register project name for per-project log file routing
  onProjectNameAvailable(projectId, project.name)

  const novelData = await prisma.novelPromotionProject.findUnique({
    where: { projectId },
    include: {
      characters: true,
      locations: true,
    },
  })
  if (!novelData) {
    throw new Error('Novel promotion data not found')
  }

  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    include: {
      clips: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!episode || episode.novelPromotionProjectId !== novelData.id) {
    throw new Error('Episode not found')
  }
  const clips = episode.clips || []
  if (clips.length === 0) {
    throw new Error('No clips found')
  }
  const retryTarget = parseStoryboardRetryTarget(retryStepKey)
  if (retryStepKey && retryStepKey !== 'voice_analyze' && !retryTarget) {
    throw new Error(`unsupported retry step for script_to_storyboard: ${retryStepKey}`)
  }
  const retryClipId = retryTarget?.clipId || null
  const selectedClips = retryClipId
    ? clips.filter((clip) => clip.id === retryClipId)
    : clips
  if (retryClipId && selectedClips.length === 0) {
    throw new Error(`Retry clip not found: ${retryClipId}`)
  }
  const skipVoiceAnalyze = !!retryStepKey && retryStepKey !== 'voice_analyze'

  const model = await resolveAnalysisModel({
    userId: data.userId,
    inputModel,
    projectAnalysisModel: novelData.analysisModel,
  })
  const [llmCapabilityOptions, workflowConcurrency] = await Promise.all([
    resolveProjectModelCapabilityGenerationOptions({
      projectId,
      userId: data.userId,
      modelType: 'llm',
      modelKey: model,
    }),
    getUserWorkflowConcurrencyConfig(data.userId),
  ])
  const capabilityReasoningEffort = llmCapabilityOptions.reasoningEffort
  const reasoningEffort = requestedReasoningEffort
    || (isReasoningEffort(capabilityReasoningEffort) ? capabilityReasoningEffort : 'high')

  const promptTemplates = getStoryboardPromptTemplates(data.locale || 'zh')
  const payloadMeta = typeof payload.meta === 'object' && payload.meta !== null
    ? (payload.meta as AnyObj)
    : {}
  const runId = typeof payload.runId === 'string' && payload.runId.trim()
    ? payload.runId.trim()
    : (typeof payloadMeta.runId === 'string' ? payloadMeta.runId.trim() : '')
  if (!runId) {
    throw new Error('runId is required for script_to_storyboard pipeline')
  }
  const workerId = buildWorkflowWorkerId(context, 'script_to_storyboard')
  const assertRunActive = async (stage: string) => {
    await assertWorkflowRunActive({
      runId,
      workerId,
      stage,
    })
  }
  const streamContext = createWorkerLLMStreamContextForTask(data.taskId, 'script_to_storyboard')
  const callbacks = createWorkerLLMStreamCallbacksContext(context, streamContext, {
    assertActive: async (stage) => {
      await assertRunActive(stage)
    },
    isActive: async () => {
      try {
        await assertRunActive('worker_llm_stream_probe')
        return true
      } catch (error) {
        if (error instanceof TaskTerminatedError) {
          return false
        }
        throw error
      }
    },
  })
  const runStep = createScriptToStoryboardRunStep({
    context,
    projectId,
    projectName: project.name,
    model,
    temperature,
    reasoning,
    reasoningEffort,
    retryStepKey,
    retryStepAttempt,
    callbacks,
    assertRunActive,
  })

  const leaseResult = await withWorkflowRunLease({
    runId,
    userId: data.userId,
    workerId,
    run: async () => {
      await reportTaskProgressContext(context, 10, {
        stage: 'script_to_storyboard_prepare',
        stageLabel: 'progress.stage.scriptToStoryboardPrepare',
        displayMode: 'detail',
      })

      const clipInputs = clips.map((clip) => buildStoryboardClipInput(clip as unknown as Record<string, unknown>))
      const selectedClipInputs = selectedClips.map((clip) => buildStoryboardClipInput(clip as unknown as Record<string, unknown>))
      const novelPromotionData = buildStoryboardNovelAssets({
        characters: novelData.characters || [],
        locations: (novelData.locations || []) as Array<Record<string, unknown> & { name: string; summary?: string | null }>,
      })
      const orchestratorResult: ScriptToStoryboardOrchestratorResult = await runStoryboardOrchestratorFlow({
        context,
        callbacks,
        concurrency: workflowConcurrency.analysis,
        runId,
        retryTarget,
        retryStepAttempt,
        selectedClips: selectedClipInputs,
        allClips: clipInputs,
        novelPromotionData,
        promptTemplates,
        runStep,
        projectId,
        projectName: project.name,
        model,
      })

      return await persistStoryboardTaskOutputs({
        context,
        callbacks,
        runId,
        retryStepKey,
        retryStepAttempt,
        episodeId,
        episodeNovelText: episode.novelText,
        skipVoiceAnalyze,
        orchestratorResult,
        novelCharacters: novelData.characters || [],
        runStep,
        assertRunActive,
      })
    },
  })

  if (!leaseResult.claimed || !leaseResult.result) {
    return {
      runId,
      skipped: true,
      episodeId,
    }
  }

  return leaseResult.result
}
