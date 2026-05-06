import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import { reportTaskProgressContext, type TaskExecutionContext } from '@/lib/workers/shared'
import { createArtifact, listArtifacts } from '@/lib/run-runtime/service'
import { parseScreenplayPayload } from './screenplay-convert-helpers'
import { asString, type AnyObj } from './story-to-script-helpers'
import type { StoryToScriptStepMeta, StoryToScriptStepOutput } from '@/lib/novel-promotion/story-to-script/orchestrator'
import { prisma } from '@/lib/prisma'

type FlushableCallbacks = {
  flush: () => Promise<void>
}

type StoryToScriptRunStep = (
  meta: StoryToScriptStepMeta,
  prompt: string,
  action: string,
  maxOutputTokens: number,
) => Promise<StoryToScriptStepOutput>

export async function runStoryToScriptRetryStep(params: {
  context: TaskExecutionContext
  callbacks: FlushableCallbacks
  runId: string
  retryStepKey: string
  retryStepAttempt: number
  retryClipId: string
  episodeId: string
  screenplayPromptTemplate: string
  runStep: StoryToScriptRunStep
}) {
  const splitArtifacts = await listArtifacts({
    runId: params.runId,
    artifactType: 'clips.split',
    limit: 1,
  })
  const latestSplit = splitArtifacts[0]
  const splitPayload = latestSplit && typeof latestSplit.payload === 'object' && latestSplit.payload !== null
    ? (latestSplit.payload as Record<string, unknown>)
    : null
  if (!splitPayload) {
    throw new Error('missing clips.split artifact for retry')
  }

  const clipRows = Array.isArray(splitPayload.clipList) ? splitPayload.clipList : []
  const retryClip = clipRows.find((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    return asString((item as Record<string, unknown>).id).trim() === params.retryClipId
  }) as Record<string, unknown> | undefined
  if (!retryClip) throw new Error(`retry clip not found in artifact: ${params.retryClipId}`)

  const clipContent = asString(retryClip.content)
  if (!clipContent.trim()) throw new Error(`retry clip content is empty: ${params.retryClipId}`)

  const screenplayPrompt = params.screenplayPromptTemplate
    .replace('{clip_content}', clipContent)
    .replace('{locations_lib_name}', asString(splitPayload.locationsLibName) || '无')
    .replace('{characters_lib_name}', asString(splitPayload.charactersLibName) || '无')
    .replace('{props_lib_name}', asString(splitPayload.propsLibName) || '无')
    .replace('{characters_introduction}', asString(splitPayload.charactersIntroduction) || '暂无角色介绍')
    .replace('{clip_id}', params.retryClipId)

  const stepMeta: StoryToScriptStepMeta = {
    stepId: params.retryStepKey,
    stepAttempt: params.retryStepAttempt,
    stepTitle: 'progress.streamStep.screenplayConversion',
    stepIndex: 1,
    stepTotal: 1,
    dependsOn: ['split_clips'],
    retryable: true,
  }

  let screenplay: AnyObj | null = null
  try {
    const stepOutput = await (async () => {
      try {
        return await withInternalLLMStreamCallbacks(
          params.callbacks,
          async () => await params.runStep(stepMeta, screenplayPrompt, 'screenplay_conversion', 2200),
        )
      } finally {
        await params.callbacks.flush()
      }
    })()
    screenplay = parseScreenplayPayload(stepOutput.text)
  } catch (error) {
    await createArtifact({
      runId: params.runId,
      stepKey: params.retryStepKey,
      artifactType: 'screenplay.clip',
      refId: params.retryClipId,
      payload: {
        clipId: params.retryClipId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    })
    throw error
  }

  if (!screenplay) {
    throw new Error('retry screenplay output is empty')
  }

  await createArtifact({
    runId: params.runId,
    stepKey: params.retryStepKey,
    artifactType: 'screenplay.clip',
    refId: params.retryClipId,
    payload: {
      clipId: params.retryClipId,
      success: true,
      sceneCount: Array.isArray(screenplay.scenes) ? screenplay.scenes.length : 0,
      screenplay,
    },
  })

  await prisma.$transaction(async (tx) => {
    let clipRecord = await tx.novelPromotionClip.findFirst({
      where: {
        episodeId: params.episodeId,
        startText: asString(retryClip.startText) || null,
        endText: asString(retryClip.endText) || null,
      },
      select: { id: true },
    })
    if (!clipRecord) {
      const clipModel = tx.novelPromotionClip as unknown as {
        create: (args: { data: Record<string, unknown>; select: { id: true } }) => Promise<{ id: string }>
      }
      clipRecord = await clipModel.create({
        data: {
          episodeId: params.episodeId,
          startText: asString(retryClip.startText) || null,
          endText: asString(retryClip.endText) || null,
          summary: asString(retryClip.summary),
          location: asString(retryClip.location) || null,
          characters: Array.isArray(retryClip.characters) ? JSON.stringify(retryClip.characters) : null,
          props: Array.isArray(retryClip.props) ? JSON.stringify(retryClip.props) : null,
          content: clipContent,
        },
        select: { id: true },
      })
    }
    await tx.novelPromotionClip.update({
      where: { id: clipRecord.id },
      data: {
        screenplay: JSON.stringify(screenplay),
      },
    })
  })

  await reportTaskProgressContext(params.context, 96, {
    stage: 'story_to_script_persist_done',
    stageLabel: 'progress.stage.storyToScriptPersistDone',
    displayMode: 'detail',
    message: 'retry step completed',
    stepId: params.retryStepKey,
    stepAttempt: params.retryStepAttempt,
    stepTitle: 'progress.streamStep.screenplayConversion',
    stepIndex: 1,
    stepTotal: 1,
  })

  return {
    episodeId: params.episodeId,
    clipCount: 1,
    screenplaySuccessCount: 1,
    screenplayFailedCount: 0,
    persistedCharacters: 0,
    persistedLocations: 0,
    persistedClips: 1,
    retryStepKey: params.retryStepKey,
  }
}
