import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import { reportTaskProgressContext, type TaskExecutionContext } from '@/lib/workers/shared'
import { createArtifact } from '@/lib/run-runtime/service'
import { prisma } from '@/lib/prisma'
import {
  runStoryToScriptOrchestrator,
  type StoryToScriptStepMeta,
  type StoryToScriptStepOutput,
  type StoryToScriptOrchestratorResult,
} from '@/lib/novel-promotion/story-to-script/orchestrator'
import {
  persistAnalyzedCharacters,
  persistAnalyzedLocations,
  persistAnalyzedProps,
  persistClips,
  resolveClipRecordId,
} from './story-to-script-helpers'

type FlushableCallbacks = {
  flush: () => Promise<void>
}

type StoryToScriptRunStep = (
  meta: StoryToScriptStepMeta,
  prompt: string,
  action: string,
  maxOutputTokens: number,
) => Promise<StoryToScriptStepOutput>

async function createStoryToScriptArtifacts(params: {
  runId: string
  episodeId: string
  result: StoryToScriptOrchestratorResult
}) {
  await createArtifact({
    runId: params.runId,
    stepKey: 'analyze_characters',
    artifactType: 'analysis.characters',
    refId: params.episodeId,
    payload: { characters: params.result.analyzedCharacters, raw: params.result.charactersObject },
  })
  await createArtifact({
    runId: params.runId,
    stepKey: 'analyze_locations',
    artifactType: 'analysis.locations',
    refId: params.episodeId,
    payload: { locations: params.result.analyzedLocations, raw: params.result.locationsObject },
  })
  await createArtifact({
    runId: params.runId,
    stepKey: 'analyze_props',
    artifactType: 'analysis.props',
    refId: params.episodeId,
    payload: { props: params.result.analyzedProps, raw: params.result.propsObject },
  })
  await createArtifact({
    runId: params.runId,
    stepKey: 'split_clips',
    artifactType: 'clips.split',
    refId: params.episodeId,
    payload: {
      clipList: params.result.clipList,
      charactersLibName: params.result.charactersLibName,
      locationsLibName: params.result.locationsLibName,
      propsLibName: params.result.propsLibName,
      charactersIntroduction: params.result.charactersIntroduction,
    },
  })
  for (const screenplayResult of params.result.screenplayResults) {
    await createArtifact({
      runId: params.runId,
      stepKey: `screenplay_${screenplayResult.clipId}`,
      artifactType: 'screenplay.clip',
      refId: screenplayResult.clipId,
      payload: { ...screenplayResult },
    })
  }
}

export async function runStoryToScriptMainFlow(params: {
  context: TaskExecutionContext
  callbacks: FlushableCallbacks
  runId: string
  episodeId: string
  content: string
  concurrency: number
  baseCharacters: string[]
  baseLocations: string[]
  baseProps: string[]
  baseCharacterIntroductions: Array<{ name: string; introduction: string }>
  promptTemplates: {
    characterPromptTemplate: string
    locationPromptTemplate: string
    propPromptTemplate: string
    clipPromptTemplate: string
    screenplayPromptTemplate: string
  }
  runStep: StoryToScriptRunStep
  assertRunActive: (stage: string) => Promise<void>
  novelData: {
    id: string
    characters: Array<{ name: string }>
    locations: Array<Record<string, unknown> & { name: string }>
  }
}) {
  const result: StoryToScriptOrchestratorResult = await (async () => {
    try {
      return await withInternalLLMStreamCallbacks(
        params.callbacks,
        async () => await runStoryToScriptOrchestrator({
          concurrency: params.concurrency,
          content: params.content,
          baseCharacters: params.baseCharacters,
          baseLocations: params.baseLocations,
          baseProps: params.baseProps,
          baseCharacterIntroductions: params.baseCharacterIntroductions,
          promptTemplates: params.promptTemplates,
          runStep: params.runStep,
        }),
      )
    } finally {
      await params.callbacks.flush()
    }
  })()

  await createStoryToScriptArtifacts({
    runId: params.runId,
    episodeId: params.episodeId,
    result,
  })

  if (result.summary.screenplayFailedCount > 0) {
    const failed = result.screenplayResults.filter((item) => !item.success)
    const preview = failed
      .slice(0, 3)
      .map((item) => `${item.clipId}:${item.error || 'unknown error'}`)
      .join(' | ')
    throw new Error(
      `STORY_TO_SCRIPT_PARTIAL_FAILED: ${result.summary.screenplayFailedCount}/${result.summary.clipCount} screenplay steps failed. ${preview}`,
    )
  }

  await reportTaskProgressContext(params.context, 80, {
    stage: 'story_to_script_persist',
    stageLabel: 'progress.stage.storyToScriptPersist',
    displayMode: 'detail',
  })
  await params.assertRunActive('story_to_script_persist')

  const episodeStillExists = await prisma.novelPromotionEpisode.findUnique({
    where: { id: params.episodeId },
    select: { id: true },
  })
  if (!episodeStillExists) {
    throw new Error(`NOT_FOUND: Episode ${params.episodeId} was deleted while the task was running`)
  }

  const existingCharacterNames = new Set<string>(params.novelData.characters.map((item) => String(item.name || '').toLowerCase()))
  const existingLocationNames = new Set<string>(
    params.novelData.locations
      .filter((item) => item.assetKind !== 'prop')
      .map((item) => String(item.name || '').toLowerCase()),
  )
  const existingPropNames = new Set<string>(
    params.novelData.locations
      .filter((item) => item.assetKind === 'prop')
      .map((item) => String(item.name || '').toLowerCase()),
  )

  const persistedResult = await prisma.$transaction(async (tx) => {
    const createdCharacters = await persistAnalyzedCharacters({
      projectInternalId: params.novelData.id,
      existingNames: existingCharacterNames,
      analyzedCharacters: result.analyzedCharacters,
      db: tx,
    })
    const createdLocations = await persistAnalyzedLocations({
      projectInternalId: params.novelData.id,
      existingNames: existingLocationNames,
      analyzedLocations: result.analyzedLocations,
      db: tx,
    })
    const createdProps = await persistAnalyzedProps({
      projectInternalId: params.novelData.id,
      existingNames: existingPropNames,
      analyzedProps: result.analyzedProps,
      db: tx,
    })
    const createdClipRows = await persistClips({
      episodeId: params.episodeId,
      clipList: result.clipList,
      db: tx,
    })
    const clipIdMap = new Map(createdClipRows.map((item) => [item.clipKey, item.id]))

    for (const screenplayResult of result.screenplayResults) {
      if (!screenplayResult.success || !screenplayResult.screenplay) continue
      const clipRecordId = resolveClipRecordId(clipIdMap, screenplayResult.clipId)
      if (!clipRecordId) continue
      await tx.novelPromotionClip.update({
        where: { id: clipRecordId },
        data: { screenplay: JSON.stringify(screenplayResult.screenplay) },
      })
    }

    return {
      createdCharacters,
      createdLocations,
      createdProps,
      createdClipRows,
    }
  })

  await reportTaskProgressContext(params.context, 96, {
    stage: 'story_to_script_persist_done',
    stageLabel: 'progress.stage.storyToScriptPersistDone',
    displayMode: 'detail',
  })

  return {
    episodeId: params.episodeId,
    clipCount: result.summary.clipCount,
    screenplaySuccessCount: result.summary.screenplaySuccessCount,
    screenplayFailedCount: result.summary.screenplayFailedCount,
    persistedCharacters: persistedResult.createdCharacters.length,
    persistedLocations: persistedResult.createdLocations.length,
    persistedProps: persistedResult.createdProps.length,
    persistedClips: persistedResult.createdClipRows.length,
  }
}
