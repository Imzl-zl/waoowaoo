import type { Job } from 'bullmq'
import { executeAiTextStep } from '@/lib/ai-runtime'
import { getProjectModelConfig } from '@/lib/config-service'
import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import { resolveInsertPanelUserInput } from '@/lib/novel-promotion/insert-panel'
import { buildInsertPanelLocationsDescription } from '@/lib/novel-promotion/insert-panel-prompt-context'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { prisma } from '@/lib/prisma'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '@/lib/workers/shared'
import { assertTaskActive } from '@/lib/workers/utils'
import { createWorkerLLMStreamCallbacks, createWorkerLLMStreamContext } from './llm-stream'
import {
  type AnyObj,
  type JsonRecord,
  parseJsonObjectResponse,
  parsePanelCharacters,
  parsePanelProps,
  readAssetKind,
  readNullableText,
} from './storyboard-text-utils'

export async function handleInsertPanelTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as AnyObj
  const storyboardId = typeof payload.storyboardId === 'string' ? payload.storyboardId : job.data.targetId
  const insertAfterPanelId = typeof payload.insertAfterPanelId === 'string' ? payload.insertAfterPanelId : ''
  const userInput = resolveInsertPanelUserInput(payload, job.data.locale)
  if (!storyboardId || !insertAfterPanelId) {
    throw new Error('insert_panel requires storyboardId/insertAfterPanelId')
  }

  const context = await loadInsertPanelContext(job, storyboardId, insertAfterPanelId)
  const prompt = buildInsertPanelPrompt({
    locale: job.data.locale,
    userInput,
    prevPanel: context.prevPanel,
    nextPanel: context.nextPanel,
    projectData: context.projectData,
    projectLocations: context.projectLocations,
    projectProps: context.projectProps,
  })

  await reportTaskProgress(job, 40, { stage: 'insert_panel_generate_text' })
  const generatedPanel = await generateInsertedPanel(job, context.analysisModel, prompt)

  await reportTaskProgress(job, 80, { stage: 'insert_panel_persist' })
  await assertTaskActive(job, 'insert_panel_transaction')
  const newPanel = await persistInsertedPanel({
    storyboardId,
    prevPanel: context.prevPanel,
    generatedPanel,
    userInput,
  })

  return {
    storyboardId,
    panelId: newPanel.id,
    panelIndex: newPanel.panelIndex,
  }
}

async function loadInsertPanelContext(job: Job<TaskJobData>, storyboardId: string, insertAfterPanelId: string) {
  const storyboard = await prisma.novelPromotionStoryboard.findUnique({
    where: { id: storyboardId },
    include: {
      clip: true,
      panels: { orderBy: { panelIndex: 'asc' } },
    },
  })
  if (!storyboard) throw new Error('Storyboard not found')

  const prevPanel = storyboard.panels.find((panel) => panel.id === insertAfterPanelId)
  if (!prevPanel) throw new Error('insert_after panel not found')
  const nextPanel = storyboard.panels.find((panel) => panel.panelIndex === prevPanel.panelIndex + 1)

  const projectModels = await getProjectModelConfig(job.data.projectId, job.data.userId)
  if (!projectModels.analysisModel) throw new Error('Analysis model not configured')

  const projectData = await prisma.novelPromotionProject.findUnique({
    where: { projectId: job.data.projectId },
    include: {
      characters: { include: { appearances: { orderBy: { appearanceIndex: 'asc' } } } },
      locations: { include: { images: { orderBy: { imageIndex: 'asc' } } } },
    },
  })
  if (!projectData) throw new Error('Novel promotion data not found')

  return {
    storyboard,
    prevPanel,
    nextPanel,
    analysisModel: projectModels.analysisModel,
    projectData,
    projectLocations: (projectData.locations || []).filter((item) => readAssetKind(item as unknown as Record<string, unknown>) !== 'prop'),
    projectProps: (projectData.locations || []).filter((item) => readAssetKind(item as unknown as Record<string, unknown>) === 'prop'),
  }
}

function buildInsertPanelPrompt(input: {
  locale: TaskJobData['locale']
  userInput: string
  prevPanel: Record<string, unknown>
  nextPanel: Record<string, unknown> | undefined
  projectData: {
    characters: Array<{
      name: string
      appearances?: Array<{
        changeReason?: string | null
        descriptions?: string | null
        selectedIndex?: number | null
        description?: string | null
      }>
    }>
  }
  projectLocations: Array<{ name: string; summary?: string | null }>
  projectProps: Array<{ name: string; summary?: string | null }>
}) {
  const prevPanelJson = JSON.stringify(serializeStoryboardPanel(input.prevPanel), null, 2)
  const nextPanelJson = input.nextPanel ? JSON.stringify(serializeStoryboardPanel(input.nextPanel), null, 2) : '无'

  const relatedCharacters = Array.from(new Set([
    ...parsePanelCharacters(input.prevPanel as { characters: string | null }),
    ...parsePanelCharacters((input.nextPanel || null) as { characters: string | null } | null),
  ]))
  const relatedLocations = Array.from(new Set([
    input.prevPanel.location,
    input.nextPanel?.location,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value))))
  const relatedProps = Array.from(new Set([
    ...parsePanelProps(input.prevPanel),
    ...parsePanelProps(input.nextPanel || null),
  ]))

  const charactersFullDescription = buildCharactersFullDescription(input.projectData.characters, relatedCharacters)
  const locationsDescription = buildInsertPanelLocationsDescription(input.projectLocations, relatedLocations, input.locale)
  const propsDescription = input.projectProps
    .filter((prop) => relatedProps.length === 0 || relatedProps.includes(prop.name))
    .map((prop) => `${prop.name}: ${prop.summary || '无描述'}`)
    .join('\n') || '无'

  return buildPrompt({
    promptId: PROMPT_IDS.NP_AGENT_STORYBOARD_INSERT,
    locale: input.locale,
    variables: {
      user_input: input.userInput,
      prev_panel_json: prevPanelJson,
      next_panel_json: nextPanelJson,
      characters_full_description: charactersFullDescription,
      locations_description: locationsDescription,
      props_description: propsDescription,
    },
  })
}

function serializeStoryboardPanel(panel: Record<string, unknown>) {
  return {
    shot_type: panel.shotType,
    camera_move: panel.cameraMove,
    description: panel.description,
    video_prompt: panel.videoPrompt,
    location: panel.location,
    characters: typeof panel.characters === 'string' ? JSON.parse(panel.characters) : [],
    props: parsePanelProps(panel),
    source_text: panel.srtSegment,
  }
}

function buildCharactersFullDescription(
  characters: Array<{
    name: string
    appearances?: Array<{
      changeReason?: string | null
      descriptions?: string | null
      selectedIndex?: number | null
      description?: string | null
    }>
  }>,
  relatedCharacters: string[],
) {
  return characters
    .filter((character) => relatedCharacters.length === 0 || relatedCharacters.includes(character.name))
    .map((character) => {
      const appearances = character.appearances || []
      if (appearances.length === 0) return `${character.name}: 无形象信息`
      const appearanceText = appearances
        .map((appearance) => {
          const descriptions = parseAppearanceDescriptions(appearance.descriptions)
          const selectedIndex = appearance.selectedIndex ?? 0
          const selectedDescription = descriptions[selectedIndex] || appearance.description || '无描述'
          return `${appearance.changeReason || '默认'}: ${selectedDescription}`
        })
        .join(' | ')
      return `${character.name}: ${appearanceText}`
    })
    .join('\n') || '无'
}

function parseAppearanceDescriptions(descriptions: string | null | undefined): string[] {
  if (!descriptions) return []
  try {
    const parsed = JSON.parse(descriptions)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

async function generateInsertedPanel(job: Job<TaskJobData>, analysisModel: string, prompt: string) {
  const streamContext = createWorkerLLMStreamContext(job, 'insert_panel')
  const callbacks = createWorkerLLMStreamCallbacks(job, streamContext)
  const completion = await withInternalLLMStreamCallbacks(
    callbacks,
    async () =>
      await executeAiTextStep({
        userId: job.data.userId,
        model: analysisModel,
        messages: [{ role: 'user', content: prompt }],
        reasoning: true,
        projectId: job.data.projectId,
        action: 'insert_panel',
        meta: {
          stepId: 'insert_panel',
          stepTitle: '插入分镜',
          stepIndex: 1,
          stepTotal: 1,
        },
      }),
  )
  await callbacks.flush()

  const responseText = completion.text
  if (!responseText) throw new Error('Insert panel completion empty')
  return parseJsonObjectResponse(responseText)
}

async function persistInsertedPanel(input: {
  storyboardId: string
  prevPanel: { panelIndex: number; shotType: string | null; cameraMove: string | null; description: string | null; videoPrompt: string | null; location: string | null; characters: string | null; srtSegment: string | null }
  generatedPanel: JsonRecord
  userInput: string
}) {
  return await prisma.$transaction(async (tx) => {
    const panelModel = tx.novelPromotionPanel as unknown as {
      create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; panelIndex: number }>
    }
    const affectedPanels = await tx.novelPromotionPanel.findMany({
      where: { storyboardId: input.storyboardId, panelIndex: { gt: input.prevPanel.panelIndex } },
      select: { id: true, panelIndex: true },
      orderBy: { panelIndex: 'asc' },
    })
    for (const panel of affectedPanels) {
      await tx.novelPromotionPanel.update({
        where: { id: panel.id },
        data: { panelIndex: -(panel.panelIndex + 1) },
      })
    }
    for (const panel of affectedPanels) {
      await tx.novelPromotionPanel.update({
        where: { id: panel.id },
        data: { panelIndex: panel.panelIndex + 1 },
      })
    }

    const created = await panelModel.create({
      data: {
        storyboardId: input.storyboardId,
        panelIndex: input.prevPanel.panelIndex + 1,
        panelNumber: input.prevPanel.panelIndex + 2,
        shotType: typeof input.generatedPanel.shot_type === 'string' ? input.generatedPanel.shot_type : input.prevPanel.shotType,
        cameraMove: typeof input.generatedPanel.camera_move === 'string' ? input.generatedPanel.camera_move : input.prevPanel.cameraMove,
        description: typeof input.generatedPanel.description === 'string' ? input.generatedPanel.description : input.userInput,
        videoPrompt:
          typeof input.generatedPanel.video_prompt === 'string'
            ? input.generatedPanel.video_prompt
            : typeof input.generatedPanel.description === 'string'
              ? input.generatedPanel.description
              : input.userInput,
        location: typeof input.generatedPanel.location === 'string' ? input.generatedPanel.location : input.prevPanel.location,
        characters: input.generatedPanel.characters ? JSON.stringify(input.generatedPanel.characters) : input.prevPanel.characters,
        props: input.generatedPanel.props ? JSON.stringify(input.generatedPanel.props) : readNullableText(input.prevPanel as unknown as Record<string, unknown>, 'props'),
        srtSegment: typeof input.generatedPanel.source_text === 'string' ? input.generatedPanel.source_text : input.prevPanel.srtSegment,
        duration: typeof input.generatedPanel.duration === 'number' ? input.generatedPanel.duration : null,
      },
    })

    await tx.novelPromotionStoryboard.update({
      where: { id: input.storyboardId },
      data: { panelCount: { increment: 1 }, updatedAt: new Date() },
    })

    return created
  })
}
