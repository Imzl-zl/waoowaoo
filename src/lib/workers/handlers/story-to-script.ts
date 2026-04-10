import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import {
  getUserWorkflowConcurrencyConfig,
  resolveProjectModelCapabilityGenerationOptions,
} from '@/lib/config-service'
import { onProjectNameAvailable } from '@/lib/logging/file-writer'
import { TaskTerminatedError } from '@/lib/task/errors'
import { reportTaskProgress } from '@/lib/workers/shared'
import { createWorkerLLMStreamCallbacks, createWorkerLLMStreamContext } from './llm-stream'
import type { TaskJobData } from '@/lib/task/types'
import {
  asString,
  type AnyObj,
  parseEffort,
  parseTemperature,
} from './story-to-script-helpers'
import { resolveAnalysisModel } from './resolve-analysis-model'
import { assertWorkflowRunActive, withWorkflowRunLease } from '@/lib/run-runtime/workflow-lease'
import {
  buildStoryToScriptBaseAssets,
  buildWorkflowWorkerId,
  createStoryToScriptRunStep,
  getStoryToScriptPromptTemplates,
  isReasoningEffort,
  readAssetKind,
  resolveRetryClipId,
} from './story-to-script-task-helpers'
import { runStoryToScriptRetryStep } from './story-to-script-retry'
import { runStoryToScriptMainFlow } from './story-to-script-pipeline'

export async function handleStoryToScriptTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as AnyObj
  const projectId = job.data.projectId
  const episodeIdRaw = asString(payload.episodeId || job.data.episodeId || '')
  const episodeId = episodeIdRaw.trim()
  const contentRaw = asString(payload.content)
  const inputModel = asString(payload.model).trim()
  const retryStepKey = asString(payload.retryStepKey).trim()
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
    select: {
      id: true,
      novelPromotionProjectId: true,
      novelText: true,
    },
  })
  if (!episode || episode.novelPromotionProjectId !== novelData.id) {
    throw new Error('Episode not found')
  }

  const model = await resolveAnalysisModel({
    userId: job.data.userId,
    inputModel,
    projectAnalysisModel: novelData.analysisModel,
  })
  const [llmCapabilityOptions, workflowConcurrency] = await Promise.all([
    resolveProjectModelCapabilityGenerationOptions({
      projectId,
      userId: job.data.userId,
      modelType: 'llm',
      modelKey: model,
    }),
    getUserWorkflowConcurrencyConfig(job.data.userId),
  ])
  const capabilityReasoningEffort = llmCapabilityOptions.reasoningEffort
  const reasoningEffort = requestedReasoningEffort
    || (isReasoningEffort(capabilityReasoningEffort) ? capabilityReasoningEffort : 'high')

  const mergedContent = contentRaw.trim() || (episode.novelText || '')
  if (!mergedContent.trim()) {
    throw new Error('content is required')
  }
  const promptTemplates = getStoryToScriptPromptTemplates(job.data.locale || 'zh')
  const maxLength = 30000
  const content = mergedContent.length > maxLength ? mergedContent.slice(0, maxLength) : mergedContent
  const payloadMeta = typeof payload.meta === 'object' && payload.meta !== null
    ? (payload.meta as AnyObj)
    : {}
  const runId = typeof payload.runId === 'string' && payload.runId.trim()
    ? payload.runId.trim()
    : (typeof payloadMeta.runId === 'string' ? payloadMeta.runId.trim() : '')
  if (!runId) {
    throw new Error('runId is required for story_to_script pipeline')
  }
  const retryClipId = resolveRetryClipId(retryStepKey)
  if (retryStepKey && !retryClipId) {
    throw new Error(`unsupported retry step for story_to_script: ${retryStepKey}`)
  }
  const workerId = buildWorkflowWorkerId(job, 'story_to_script')
  const assertRunActive = async (stage: string) => {
    await assertWorkflowRunActive({
      runId,
      workerId,
      stage,
    })
  }
  const streamContext = createWorkerLLMStreamContext(job, 'story_to_script')
  const callbacks = createWorkerLLMStreamCallbacks(job, streamContext, {
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

  const runStep = createStoryToScriptRunStep({
    job,
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
    userId: job.data.userId,
    workerId,
    run: async () => {
      await reportTaskProgress(job, 10, {
        stage: 'story_to_script_prepare',
        stageLabel: 'progress.stage.storyToScriptPrepare',
        displayMode: 'detail',
      })

      if (retryClipId) {
        return await runStoryToScriptRetryStep({
          job,
          callbacks,
          runId,
          retryStepKey,
          retryStepAttempt,
          retryClipId,
          episodeId,
          screenplayPromptTemplate: promptTemplates.screenplayPromptTemplate,
          runStep,
        })
      }

      const baseAssets = buildStoryToScriptBaseAssets({
        characters: novelData.characters || [],
        locations: (novelData.locations || []) as Array<Record<string, unknown> & { name: string }>,
      })
      return await runStoryToScriptMainFlow({
        job,
        callbacks,
        runId,
        episodeId,
        content,
        concurrency: workflowConcurrency.analysis,
        ...baseAssets,
        promptTemplates,
        runStep,
        assertRunActive,
        novelData: {
          id: novelData.id,
          characters: novelData.characters || [],
          locations: (novelData.locations || []) as Array<Record<string, unknown> & { name: string }>,
        },
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
