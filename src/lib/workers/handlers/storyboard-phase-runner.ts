import type { TaskJobData } from '@/lib/task/types'
import {
  executePhase1,
  executePhase2,
  executePhase2Acting,
  executePhase3,
  type ActingDirection,
  type CharacterAsset,
  type LocationAsset,
  type PhotographyRule,
  type StoryboardPanel,
} from '@/lib/storyboard-phases'

type StoryboardPhaseClip = {
  id: string
  content: string | null
  characters: string | null
  location: string | null
  props?: string | null
  screenplay: string | null
}

type StoryboardPhaseNovelPromotionData = {
  analysisModel: string
  characters: CharacterAsset[]
  locations: LocationAsset[]
  props?: Array<{ name: string; summary?: string | null }>
}

export async function runStoryboardPhasesForClip(params: {
  clip: StoryboardPhaseClip
  novelPromotionData: StoryboardPhaseNovelPromotionData
  projectId: string
  projectName: string
  userId: string
  locale: TaskJobData['locale']
}): Promise<StoryboardPanel[]> {
  const session = { user: { id: params.userId, name: 'Worker' } }
  const phase1 = await executePhase1(
    params.clip,
    params.novelPromotionData,
    session,
    params.projectId,
    params.projectName,
    params.locale,
  )
  const phase1Panels = phase1.planPanels || []
  const [phase2, phase2Acting, phase3] = await Promise.all([
    executePhase2(params.clip, phase1Panels, params.novelPromotionData, session, params.projectId, params.projectName, params.locale),
    executePhase2Acting(params.clip, phase1Panels, params.novelPromotionData, session, params.projectId, params.projectName, params.locale),
    executePhase3(params.clip, phase1Panels, [], params.novelPromotionData, session, params.projectId, params.projectName, params.locale),
  ])

  return mergeStoryboardPhaseOutputs({
    finalPanels: phase3.finalPanels || [],
    photographyRules: phase2.photographyRules || [],
    actingDirections: phase2Acting.actingDirections || [],
  })
}

function mergeStoryboardPhaseOutputs(input: {
  finalPanels: StoryboardPanel[]
  photographyRules: PhotographyRule[]
  actingDirections: ActingDirection[]
}): StoryboardPanel[] {
  return input.finalPanels.map((panel, index) => {
    const rules = input.photographyRules.find((rule) => rule.panel_number === panel.panel_number) || input.photographyRules[index]
    const acting = input.actingDirections.find((direction) => direction.panel_number === panel.panel_number) || input.actingDirections[index]

    return {
      ...panel,
      ...(rules
        ? {
          photographyPlan: {
            composition: rules.composition,
            lighting: rules.lighting,
            colorPalette: rules.color_palette,
            atmosphere: rules.atmosphere,
            technicalNotes: rules.technical_notes,
          },
        }
        : {}),
      ...(acting?.characters ? { actingNotes: acting.characters } : {}),
    }
  })
}
