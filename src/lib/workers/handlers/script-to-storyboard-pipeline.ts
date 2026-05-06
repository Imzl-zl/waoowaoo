import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import { logAIAnalysis } from '@/lib/logging/semantic'
import { buildCharactersIntroduction } from '@/lib/constants'
import { TaskTerminatedError } from '@/lib/task/errors'
import { reportTaskProgressContext, type TaskExecutionContext } from '@/lib/workers/shared'
import { JsonParseError, runScriptToStoryboardOrchestrator, type ScriptToStoryboardStepMeta, type ScriptToStoryboardStepOutput, type ScriptToStoryboardOrchestratorResult } from '@/lib/novel-promotion/script-to-storyboard/orchestrator'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { createArtifact } from '@/lib/run-runtime/service'
import { buildStoryboardJsonFromClipPanels, parseVoiceLinesJson, persistStoryboardOutputs, type JsonRecord } from './script-to-storyboard-helpers'
import { runScriptToStoryboardAtomicRetry, type StoryboardRetryTarget } from './script-to-storyboard-atomic-retry'

type FlushableCallbacks = { flush: () => Promise<void> }
type StoryboardRunStep = (meta: ScriptToStoryboardStepMeta, prompt: string, action: string, maxOutputTokens: number) => Promise<ScriptToStoryboardStepOutput>
type StoryboardClipRecord = { id: string; content: string | null; characters: string | null; location: string | null; props: string | null; screenplay: string | null }

const MAX_VOICE_ANALYZE_ATTEMPTS = 2

async function createClipPhaseArtifacts(params: {
  runId: string
  clipId: string
  phase1Panels: unknown[]
  phase2Cinematography: unknown[]
  phase2Acting: unknown[]
  phase3Panels: unknown[]
}) {
  const specs = [
    { stepKey: `clip_${params.clipId}_phase1`, artifactType: 'storyboard.clip.phase1', payload: { panels: params.phase1Panels }, enabled: params.phase1Panels.length > 0 },
    { stepKey: `clip_${params.clipId}_phase2_cinematography`, artifactType: 'storyboard.clip.phase2.cine', payload: { rules: params.phase2Cinematography }, enabled: params.phase2Cinematography.length > 0 },
    { stepKey: `clip_${params.clipId}_phase2_acting`, artifactType: 'storyboard.clip.phase2.acting', payload: { directions: params.phase2Acting }, enabled: params.phase2Acting.length > 0 },
    { stepKey: `clip_${params.clipId}_phase3_detail`, artifactType: 'storyboard.clip.phase3', payload: { panels: params.phase3Panels }, enabled: params.phase3Panels.length > 0 },
  ]
  for (const spec of specs) {
    if (!spec.enabled) continue
    await createArtifact({ runId: params.runId, stepKey: spec.stepKey, artifactType: spec.artifactType, refId: params.clipId, payload: spec.payload })
  }
}

export async function runStoryboardOrchestratorFlow(params: {
  context: TaskExecutionContext
  callbacks: FlushableCallbacks
  concurrency: number
  runId: string
  retryTarget: StoryboardRetryTarget | null
  retryStepAttempt: number
  selectedClips: StoryboardClipRecord[]
  allClips: StoryboardClipRecord[]
  novelPromotionData: { characters: Array<{ name: string }>; locations: Array<{ name: string }>; props: Array<{ name: string; summary?: string | null }> }
  promptTemplates: { phase1PlanTemplate: string; phase2CinematographyTemplate: string; phase2ActingTemplate: string; phase3DetailTemplate: string }
  runStep: StoryboardRunStep
  projectId: string
  projectName: string
  model: string
}): Promise<ScriptToStoryboardOrchestratorResult> {
  const orchestratorResult = await (async () => {
    try {
      return await withInternalLLMStreamCallbacks(
        params.callbacks,
        async () => {
          if (params.retryTarget) {
            const clipIndex = params.allClips.findIndex((clip) => clip.id === params.retryTarget?.clipId)
            if (clipIndex < 0) {
              throw new Error(`Retry clip not found: ${params.retryTarget.clipId}`)
            }
            const clip = params.allClips[clipIndex]
            const atomicResult = await runScriptToStoryboardAtomicRetry({
              runId: params.runId,
              retryTarget: params.retryTarget,
              retryStepAttempt: params.retryStepAttempt,
              locale: params.context.data.locale,
              clip,
              clipIndex,
              totalClipCount: params.allClips.length,
              novelPromotionData: params.novelPromotionData,
              promptTemplates: params.promptTemplates,
              runStep: params.runStep,
            })
            return {
              clipPanels: atomicResult.clipPanels,
              phase1PanelsByClipId: atomicResult.phase1PanelsByClipId,
              phase2CinematographyByClipId: atomicResult.phase2CinematographyByClipId,
              phase2ActingByClipId: atomicResult.phase2ActingByClipId,
              phase3PanelsByClipId: atomicResult.phase3PanelsByClipId,
              summary: {
                clipCount: params.selectedClips.length,
                totalPanelCount: atomicResult.totalPanelCount,
                totalStepCount: atomicResult.totalStepCount,
              },
            }
          }

          try {
            return await runScriptToStoryboardOrchestrator({
              concurrency: params.concurrency,
              locale: params.context.data.locale,
              clips: params.selectedClips,
              novelPromotionData: params.novelPromotionData,
              promptTemplates: params.promptTemplates,
              runStep: params.runStep,
            })
          } catch (error) {
            if (error instanceof JsonParseError) {
              logAIAnalysis(params.context.data.userId, 'worker', params.projectId, params.projectName, {
                action: 'SCRIPT_TO_STORYBOARD_PARSE_ERROR',
                error: {
                  message: error.message,
                  rawTextPreview: error.rawText.slice(0, 3000),
                  rawTextLength: error.rawText.length,
                },
                model: params.model,
              })
            }
            throw error
          }
        },
      )
    } finally {
      await params.callbacks.flush()
    }
  })()

  const phase1Map = orchestratorResult.phase1PanelsByClipId || {}
  const phase2CinematographyMap = orchestratorResult.phase2CinematographyByClipId || {}
  const phase2ActingMap = orchestratorResult.phase2ActingByClipId || {}
  const phase3Map = orchestratorResult.phase3PanelsByClipId || {}

  for (const clip of params.selectedClips) {
    await createClipPhaseArtifacts({
      runId: params.runId,
      clipId: clip.id,
      phase1Panels: phase1Map[clip.id] || [],
      phase2Cinematography: phase2CinematographyMap[clip.id] || [],
      phase2Acting: phase2ActingMap[clip.id] || [],
      phase3Panels: phase3Map[clip.id] || [],
    })
  }

  return orchestratorResult
}

export async function persistStoryboardTaskOutputs(params: {
  context: TaskExecutionContext
  callbacks: FlushableCallbacks
  runId: string
  retryStepKey: string
  retryStepAttempt: number
  episodeId: string
  episodeNovelText: string | null
  skipVoiceAnalyze: boolean
  orchestratorResult: ScriptToStoryboardOrchestratorResult
  novelCharacters: Array<{ name: string; introduction?: string | null }>
  runStep: StoryboardRunStep
  assertRunActive: (stage: string) => Promise<void>
}) {
  await reportTaskProgressContext(params.context, 80, {
    stage: 'script_to_storyboard_persist',
    stageLabel: 'progress.stage.scriptToStoryboardPersist',
    displayMode: 'detail',
  })
  await params.assertRunActive('script_to_storyboard_persist')

  if (params.skipVoiceAnalyze) {
    const persisted = await persistStoryboardOutputs({
      episodeId: params.episodeId,
      clipPanels: params.orchestratorResult.clipPanels,
      voiceLineRows: null,
    })
    await reportTaskProgressContext(params.context, 96, {
      stage: 'script_to_storyboard_persist_done',
      stageLabel: 'progress.stage.scriptToStoryboardPersistDone',
      displayMode: 'detail',
      message: 'step retry complete',
      stepId: params.retryStepKey || undefined,
      stepAttempt: params.retryStepKey ? params.retryStepAttempt : undefined,
    })
    return {
      episodeId: params.episodeId,
      storyboardCount: persisted.persistedStoryboards.length,
      panelCount: params.orchestratorResult.summary.totalPanelCount,
      voiceLineCount: 0,
      retryStepKey: params.retryStepKey,
    }
  }

  if (!params.episodeNovelText || !params.episodeNovelText.trim()) {
    throw new Error('No novel text to analyze')
  }

  const voicePrompt = buildPrompt({
    promptId: PROMPT_IDS.NP_VOICE_ANALYSIS,
    locale: params.context.data.locale,
    variables: {
      input: params.episodeNovelText,
      characters_lib_name: params.novelCharacters.length > 0
        ? params.novelCharacters.map((item) => item.name).join('、')
        : '无',
      characters_introduction: buildCharactersIntroduction(params.novelCharacters),
      storyboard_json: buildStoryboardJsonFromClipPanels(params.orchestratorResult.clipPanels),
    },
  })

  let voiceLineRows: JsonRecord[] | null = null
  let voiceLastError: Error | null = null
  const voiceStepMeta: ScriptToStoryboardStepMeta = {
    stepId: 'voice_analyze',
    stepTitle: 'progress.streamStep.voiceAnalyze',
    stepIndex: params.orchestratorResult.summary.totalStepCount,
    stepTotal: params.orchestratorResult.summary.totalStepCount,
    retryable: true,
  }

  try {
    for (let voiceAttempt = 1; voiceAttempt <= MAX_VOICE_ANALYZE_ATTEMPTS; voiceAttempt += 1) {
      const meta: ScriptToStoryboardStepMeta = {
        ...voiceStepMeta,
        stepAttempt: voiceAttempt,
      }
      try {
        const voiceOutput = await withInternalLLMStreamCallbacks(
          params.callbacks,
          async () => await params.runStep(meta, voicePrompt, 'voice_analyze', 2600),
        )
        voiceLineRows = parseVoiceLinesJson(voiceOutput.text)
        break
      } catch (error) {
        if (error instanceof TaskTerminatedError) throw error
        voiceLastError = error instanceof Error ? error : new Error(String(error))
        if (voiceAttempt < MAX_VOICE_ANALYZE_ATTEMPTS) {
          await reportTaskProgressContext(params.context, 84, {
            stage: 'script_to_storyboard_step',
            stageLabel: 'progress.stage.scriptToStoryboardStep',
            displayMode: 'detail',
            message: `台词分析失败，准备重试 (${voiceAttempt + 1}/${MAX_VOICE_ANALYZE_ATTEMPTS})`,
            stepId: voiceStepMeta.stepId,
            stepAttempt: voiceAttempt + 1,
            stepTitle: voiceStepMeta.stepTitle,
            stepIndex: voiceStepMeta.stepIndex,
            stepTotal: voiceStepMeta.stepTotal,
          })
        }
      }
    }
  } finally {
    await params.callbacks.flush()
  }

  if (!voiceLineRows) throw voiceLastError || new Error('voice analyze failed')

  await createArtifact({
    runId: params.runId,
    stepKey: 'voice_analyze',
    artifactType: 'voice.lines',
    refId: params.episodeId,
    payload: { lines: voiceLineRows },
  })

  await params.assertRunActive('script_to_storyboard_voice_persist')
  const persisted = await persistStoryboardOutputs({
    episodeId: params.episodeId,
    clipPanels: params.orchestratorResult.clipPanels,
    voiceLineRows,
  })

  await reportTaskProgressContext(params.context, 96, {
    stage: 'script_to_storyboard_persist_done',
    stageLabel: 'progress.stage.scriptToStoryboardPersistDone',
    displayMode: 'detail',
  })

  return {
    episodeId: params.episodeId,
    storyboardCount: persisted.persistedStoryboards.length,
    panelCount: params.orchestratorResult.summary.totalPanelCount,
    voiceLineCount: persisted.voiceLineCount,
  }
}
