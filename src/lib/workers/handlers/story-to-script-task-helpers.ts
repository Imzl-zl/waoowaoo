import { executeAiTextStep } from '@/lib/ai-runtime'
import { logAIAnalysis } from '@/lib/logging/semantic'
import { reportTaskProgressContext, type TaskExecutionContext } from '@/lib/workers/shared'
import type {
  StoryToScriptStepMeta,
  StoryToScriptStepOutput,
} from '@/lib/novel-promotion/story-to-script/orchestrator'
import { getPromptTemplate, PROMPT_IDS } from '@/lib/prompt-i18n'

type FlushableCallbacks = {
  flush: () => Promise<void>
}

export function readAssetKind(value: Record<string, unknown>): string {
  return typeof value.assetKind === 'string' ? value.assetKind : 'location'
}

export function isReasoningEffort(value: unknown): value is 'minimal' | 'low' | 'medium' | 'high' {
  return value === 'minimal' || value === 'low' || value === 'medium' || value === 'high'
}

export function resolveRetryClipId(retryStepKey: string): string | null {
  if (!retryStepKey.startsWith('screenplay_')) return null
  const clipId = retryStepKey.slice('screenplay_'.length).trim()
  return clipId || null
}

export function buildWorkflowWorkerId(context: TaskExecutionContext, label: string) {
  return `${label}:${context.queueName}:${context.data.taskId}`
}

export function getStoryToScriptPromptTemplates(locale: 'zh' | 'en') {
  return {
    characterPromptTemplate: getPromptTemplate(PROMPT_IDS.NP_AGENT_CHARACTER_PROFILE, locale),
    locationPromptTemplate: getPromptTemplate(PROMPT_IDS.NP_SELECT_LOCATION, locale),
    propPromptTemplate: getPromptTemplate(PROMPT_IDS.NP_SELECT_PROP, locale),
    clipPromptTemplate: getPromptTemplate(PROMPT_IDS.NP_AGENT_CLIP, locale),
    screenplayPromptTemplate: getPromptTemplate(PROMPT_IDS.NP_SCREENPLAY_CONVERSION, locale),
  }
}

export function buildStoryToScriptBaseAssets(novelData: {
  characters?: Array<{ name: string; introduction?: string | null }>
  locations?: Array<Record<string, unknown> & { name: string }>
}) {
  return {
    baseCharacters: (novelData.characters || []).map((item) => item.name),
    baseLocations: (novelData.locations || [])
      .filter((item) => readAssetKind(item) !== 'prop')
      .map((item) => item.name),
    baseProps: (novelData.locations || [])
      .filter((item) => readAssetKind(item) === 'prop')
      .map((item) => item.name),
    baseCharacterIntroductions: (novelData.characters || []).map((item) => ({
      name: item.name,
      introduction: item.introduction || '',
    })),
  }
}

export function createStoryToScriptRunStep(params: {
  context: TaskExecutionContext
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
    meta: StoryToScriptStepMeta,
    prompt: string,
    action: string,
    _maxOutputTokens: number,
  ): Promise<StoryToScriptStepOutput> => {
    void _maxOutputTokens
    const stepAttempt = meta.stepAttempt
      || (params.retryStepKey && meta.stepId === params.retryStepKey ? params.retryStepAttempt : 1)
    await params.assertRunActive(`story_to_script_step:${meta.stepId}`)
    const progress = 15 + Math.min(55, Math.floor((meta.stepIndex / Math.max(1, meta.stepTotal)) * 55))
    await reportTaskProgressContext(params.context, progress, {
      stage: 'story_to_script_step',
      stageLabel: 'progress.stage.storyToScriptStep',
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

    logAIAnalysis(params.context.data.userId, 'worker', params.projectId, params.projectName, {
      action: `STORY_TO_SCRIPT_PROMPT:${action}`,
      input: { stepId: meta.stepId, stepTitle: meta.stepTitle, prompt },
      model: params.model,
    })

    const output = await executeAiTextStep({
      userId: params.context.data.userId,
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

    logAIAnalysis(params.context.data.userId, 'worker', params.projectId, params.projectName, {
      action: `STORY_TO_SCRIPT_OUTPUT:${action}`,
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
