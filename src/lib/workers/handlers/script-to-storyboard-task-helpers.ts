import type { Job } from 'bullmq'
import { executeAiTextStep } from '@/lib/ai-runtime'
import { logAIAnalysis } from '@/lib/logging/semantic'
import { reportTaskProgress } from '@/lib/workers/shared'
import type {
  ScriptToStoryboardStepMeta,
  ScriptToStoryboardStepOutput,
} from '@/lib/novel-promotion/script-to-storyboard/orchestrator'
import type { TaskJobData } from '@/lib/task/types'
import { getPromptTemplate, PROMPT_IDS } from '@/lib/prompt-i18n'

export type AnyObj = Record<string, unknown>

type FlushableCallbacks = {
  flush: () => Promise<void>
}

export function buildWorkflowWorkerId(job: Job<TaskJobData>, label: string) {
  return `${label}:${job.queueName}:${job.data.taskId}`
}

export function readAssetKind(value: Record<string, unknown>): string {
  return typeof value.assetKind === 'string' ? value.assetKind : 'location'
}

export function readNullableText(value: Record<string, unknown>, key: string): string | null {
  const field = value[key]
  return typeof field === 'string' ? field : null
}

export function isReasoningEffort(value: unknown): value is 'minimal' | 'low' | 'medium' | 'high' {
  return value === 'minimal' || value === 'low' || value === 'medium' || value === 'high'
}

export function getStoryboardPromptTemplates(locale: 'zh' | 'en') {
  return {
    phase1PlanTemplate: getPromptTemplate(PROMPT_IDS.NP_AGENT_STORYBOARD_PLAN, locale),
    phase2CinematographyTemplate: getPromptTemplate(PROMPT_IDS.NP_AGENT_CINEMATOGRAPHER, locale),
    phase2ActingTemplate: getPromptTemplate(PROMPT_IDS.NP_AGENT_ACTING_DIRECTION, locale),
    phase3DetailTemplate: getPromptTemplate(PROMPT_IDS.NP_AGENT_STORYBOARD_DETAIL, locale),
  }
}

export function buildStoryboardNovelAssets(novelData: {
  characters?: Array<{ name: string }>
  locations?: Array<Record<string, unknown> & { name: string; summary?: string | null }>
}) {
  return {
    characters: novelData.characters || [],
    locations: (novelData.locations || []).filter((item) => readAssetKind(item) !== 'prop'),
    props: (novelData.locations || [])
      .filter((item) => readAssetKind(item) === 'prop')
      .map((item) => ({ name: item.name, summary: item.summary })),
  }
}

export function buildStoryboardClipInput(clip: Record<string, unknown>) {
  return {
    id: String(clip.id || ''),
    content: typeof clip.content === 'string' ? clip.content : null,
    characters: typeof clip.characters === 'string' ? clip.characters : null,
    location: typeof clip.location === 'string' ? clip.location : null,
    props: readNullableText(clip, 'props'),
    screenplay: typeof clip.screenplay === 'string' ? clip.screenplay : null,
  }
}

export function createScriptToStoryboardRunStep(params: {
  job: Job<TaskJobData>
  projectId: string
  projectName: string
  model: string
  temperature: number
  reasoning: boolean
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high'
  retryStepKey: string
  retryStepAttempt: number
  callbacks: FlushableCallbacks
  assertRunActive: (stage: string) => Promise<void>
}) {
  return async (
    meta: ScriptToStoryboardStepMeta,
    prompt: string,
    action: string,
    _maxOutputTokens: number,
  ): Promise<ScriptToStoryboardStepOutput> => {
    void _maxOutputTokens
    const stepAttempt = meta.stepAttempt
      || (params.retryStepKey && meta.stepId === params.retryStepKey ? params.retryStepAttempt : 1)
    await params.assertRunActive(`script_to_storyboard_step:${meta.stepId}`)
    const progress = 15 + Math.min(70, Math.floor((meta.stepIndex / Math.max(1, meta.stepTotal)) * 70))
    await reportTaskProgress(params.job, progress, {
      stage: 'script_to_storyboard_step',
      stageLabel: 'progress.stage.scriptToStoryboardStep',
      displayMode: 'detail',
      message: meta.stepTitle,
      stepId: meta.stepId,
      stepAttempt,
      stepTitle: meta.stepTitle,
      stepIndex: meta.stepIndex,
      stepTotal: meta.stepTotal,
      dependsOn: Array.isArray(meta.dependsOn) ? meta.dependsOn : [],
      groupId: meta.groupId || null,
      parallelKey: meta.parallelKey || null,
      retryable: meta.retryable !== false,
      blockedBy: Array.isArray(meta.blockedBy) ? meta.blockedBy : [],
    })

    logAIAnalysis(params.job.data.userId, 'worker', params.projectId, params.projectName, {
      action: `SCRIPT_TO_STORYBOARD_PROMPT:${action}`,
      input: { stepId: meta.stepId, stepTitle: meta.stepTitle, prompt },
      model: params.model,
    })

    const output = await executeAiTextStep({
      userId: params.job.data.userId,
      model: params.model,
      messages: [{ role: 'user', content: prompt }],
      projectId: params.projectId,
      action,
      meta: {
        ...meta,
        stepAttempt,
      },
      temperature: params.temperature,
      reasoning: params.reasoning,
      reasoningEffort: params.reasoningEffort,
    })
    await params.callbacks.flush()

    logAIAnalysis(params.job.data.userId, 'worker', params.projectId, params.projectName, {
      action: `SCRIPT_TO_STORYBOARD_OUTPUT:${action}`,
      output: {
        stepId: meta.stepId,
        stepTitle: meta.stepTitle,
        rawText: output.text,
        textLength: output.text.length,
        reasoningLength: output.reasoning.length,
      },
      model: params.model,
    })

    return {
      text: output.text,
      reasoning: output.reasoning,
    }
  }
}
