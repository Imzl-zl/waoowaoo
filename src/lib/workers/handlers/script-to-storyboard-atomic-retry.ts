import { buildCharactersIntroduction } from '@/lib/constants'
import type {
  ScriptToStoryboardPromptTemplates,
} from '@/lib/novel-promotion/script-to-storyboard/orchestrator'
import {
  type ActingDirection,
  type CharacterAsset,
  formatClipId,
  getFilteredAppearanceList,
  getFilteredFullDescription,
  getFilteredLocationsDescription,
  type LocationAsset,
  type PropAsset,
  type PhotographyRule,
  type StoryboardPanel,
} from '@/lib/storyboard-phases'
import type { ClipPanelsResult } from './script-to-storyboard-helpers'
import {
  buildPromptAssetContext,
  compileAssetPromptFragments,
} from '@/lib/assets/services/asset-prompt-context'
import {
  buildStepMeta,
  mergePanelsWithRules,
  parseClipCharacters,
  parseClipProps,
  parseJsonArray,
  parseScreenplay,
  parseStoryboardRetryTarget,
  readArtifactRows,
  requireRows,
  runStepWithRetry,
  type ScriptToStoryboardAtomicRetryResult,
  type StepRunner,
  type StoryboardClipInput,
  type StoryboardRetryTarget,
} from './script-to-storyboard-atomic-retry.shared'

export {
  parseStoryboardRetryTarget,
  type ScriptToStoryboardAtomicRetryResult,
  type StoryboardRetryPhase,
  type StoryboardRetryTarget,
} from './script-to-storyboard-atomic-retry.shared'

export async function runScriptToStoryboardAtomicRetry(params: {
  runId: string
  retryTarget: StoryboardRetryTarget
  retryStepAttempt: number
  locale?: 'zh' | 'en'
  clip: StoryboardClipInput
  clipIndex: number
  totalClipCount: number
  novelPromotionData: {
    characters: CharacterAsset[]
    locations: LocationAsset[]
    props?: PropAsset[]
  }
  promptTemplates: ScriptToStoryboardPromptTemplates
  runStep: StepRunner
}): Promise<ScriptToStoryboardAtomicRetryResult> {
  const clipCharacters = parseClipCharacters(params.clip.characters)
  const clipLocation = params.clip.location || null
  const clipProps = parseClipProps(params.clip.props ?? null)
  const filteredFullDescription = getFilteredFullDescription(params.novelPromotionData.characters || [], clipCharacters)
  const filteredLocationsDescription = getFilteredLocationsDescription(
    params.novelPromotionData.locations || [],
    clipLocation,
    params.locale ?? 'zh',
  )
  const filteredPropsDescription = compileAssetPromptFragments(buildPromptAssetContext({
    characters: [],
    locations: [],
    props: params.novelPromotionData.props || [],
    clipCharacters: [],
    clipLocation: null,
    clipProps,
  })).propsDescriptionText
  const baseMeta = buildStepMeta({
    target: params.retryTarget,
    clipIndex: params.clipIndex,
    totalClipCount: params.totalClipCount,
  })

  const phase1PanelsByClipId: Record<string, StoryboardPanel[]> = {}
  const phase2CinematographyByClipId: Record<string, PhotographyRule[]> = {}
  const phase2ActingByClipId: Record<string, ActingDirection[]> = {}
  const phase3PanelsByClipId: Record<string, StoryboardPanel[]> = {}
  const clipPanels: ClipPanelsResult[] = []

  let phase1Panels = await readArtifactRows<StoryboardPanel>({
    runId: params.runId,
    clipId: params.retryTarget.clipId,
    artifactType: 'storyboard.clip.phase1',
    key: 'panels',
  })
  let phase2Cinematography = await readArtifactRows<PhotographyRule>({
    runId: params.runId,
    clipId: params.retryTarget.clipId,
    artifactType: 'storyboard.clip.phase2.cine',
    key: 'rules',
  })
  let phase2Acting = await readArtifactRows<ActingDirection>({
    runId: params.runId,
    clipId: params.retryTarget.clipId,
    artifactType: 'storyboard.clip.phase2.acting',
    key: 'directions',
  })
  let phase3Panels = await readArtifactRows<StoryboardPanel>({
    runId: params.runId,
    clipId: params.retryTarget.clipId,
    artifactType: 'storyboard.clip.phase3',
    key: 'panels',
  })

  if (params.retryTarget.phase === 'phase1') {
    const clipContent = typeof params.clip.content === 'string' ? params.clip.content.trim() : ''
    if (!clipContent) {
      throw new Error(`Clip ${formatClipId(params.clip)} content is empty`)
    }
    const filteredAppearanceList = getFilteredAppearanceList(params.novelPromotionData.characters || [], clipCharacters)
    const charactersLibName = (params.novelPromotionData.characters || []).map((item) => item.name).join(', ') || '无'
    const locationsLibName = (params.novelPromotionData.locations || []).map((item) => item.name).join(', ') || '无'
    const charactersIntroduction = buildCharactersIntroduction(params.novelPromotionData.characters || [])
    const clipJson = JSON.stringify(
      {
        id: params.clip.id,
        content: clipContent,
        characters: clipCharacters,
        location: clipLocation,
        props: clipProps,
      },
      null,
      2,
    )
    let phase1Prompt = params.promptTemplates.phase1PlanTemplate
      .replace('{characters_lib_name}', charactersLibName)
      .replace('{locations_lib_name}', locationsLibName)
      .replace('{characters_introduction}', charactersIntroduction)
      .replace('{characters_appearance_list}', filteredAppearanceList)
      .replace('{characters_full_description}', filteredFullDescription)
      .replace('{props_description}', filteredPropsDescription)
      .replace('{clip_json}', clipJson)
    const screenplay = parseScreenplay(params.clip.screenplay)
    if (screenplay) {
      phase1Prompt = phase1Prompt.replace('{clip_content}', `【剧本格式】\n${JSON.stringify(screenplay, null, 2)}`)
    } else {
      phase1Prompt = phase1Prompt.replace('{clip_content}', clipContent)
    }
    phase1Panels = await runStepWithRetry({
      runStep: params.runStep,
      baseMeta,
      prompt: phase1Prompt,
      action: 'storyboard_phase1_plan',
      maxOutputTokens: 2600,
      parse: (text) => {
        const panels = parseJsonArray<StoryboardPanel>(text, `phase1:${formatClipId(params.clip)}`)
        if (panels.length === 0) {
          throw new Error(`Phase 1 returned empty panels for clip ${formatClipId(params.clip)}`)
        }
        return panels
      },
      retryStepAttempt: params.retryStepAttempt,
    })
    phase1PanelsByClipId[params.clip.id] = phase1Panels
  } else if (params.retryTarget.phase === 'phase2_cinematography') {
    const planPanels = requireRows(phase1Panels, 'storyboard.clip.phase1')
    const phase2Prompt = params.promptTemplates.phase2CinematographyTemplate
      .replace('{panels_json}', JSON.stringify(planPanels, null, 2))
      .replace(/\{panel_count\}/g, String(planPanels.length))
      .replace('{locations_description}', filteredLocationsDescription)
      .replace('{characters_info}', filteredFullDescription)
      .replace('{props_description}', filteredPropsDescription)
    phase2Cinematography = await runStepWithRetry({
      runStep: params.runStep,
      baseMeta,
      prompt: phase2Prompt,
      action: 'storyboard_phase2_cinematography',
      maxOutputTokens: 2400,
      parse: (text) => parseJsonArray<PhotographyRule>(text, `phase2:${formatClipId(params.clip)}`),
      retryStepAttempt: params.retryStepAttempt,
    })
    phase2CinematographyByClipId[params.clip.id] = phase2Cinematography
  } else if (params.retryTarget.phase === 'phase2_acting') {
    const planPanels = requireRows(phase1Panels, 'storyboard.clip.phase1')
    const phase2ActingPrompt = params.promptTemplates.phase2ActingTemplate
      .replace('{panels_json}', JSON.stringify(planPanels, null, 2))
      .replace(/\{panel_count\}/g, String(planPanels.length))
      .replace('{characters_info}', filteredFullDescription)
    phase2Acting = await runStepWithRetry({
      runStep: params.runStep,
      baseMeta,
      prompt: phase2ActingPrompt,
      action: 'storyboard_phase2_acting',
      maxOutputTokens: 2400,
      parse: (text) => parseJsonArray<ActingDirection>(text, `phase2-acting:${formatClipId(params.clip)}`),
      retryStepAttempt: params.retryStepAttempt,
    })
    phase2ActingByClipId[params.clip.id] = phase2Acting
  } else {
    const planPanels = requireRows(phase1Panels, 'storyboard.clip.phase1')
    const phase3Prompt = params.promptTemplates.phase3DetailTemplate
      .replace('{panels_json}', JSON.stringify(planPanels, null, 2))
      .replace('{characters_age_gender}', filteredFullDescription)
      .replace('{locations_description}', filteredLocationsDescription)
      .replace('{props_description}', filteredPropsDescription)
    phase3Panels = await runStepWithRetry({
      runStep: params.runStep,
      baseMeta,
      prompt: phase3Prompt,
      action: 'storyboard_phase3_detail',
      maxOutputTokens: 2600,
      parse: (text) => {
        const parsed = parseJsonArray<StoryboardPanel>(text, `phase3:${formatClipId(params.clip)}`)
        const filtered = parsed.filter(
          (panel) => panel.description && panel.description !== '无' && panel.location !== '无',
        )
        if (filtered.length === 0) {
          throw new Error(`Phase 3 returned empty valid panels for clip ${formatClipId(params.clip)}`)
        }
        return filtered
      },
      retryStepAttempt: params.retryStepAttempt,
    })
    phase3PanelsByClipId[params.clip.id] = phase3Panels
  }

  if (params.retryTarget.phase !== 'phase1') {
    const finalPanels = mergePanelsWithRules({
      finalPanels: requireRows(phase3Panels, 'storyboard.clip.phase3'),
      photographyRules: requireRows(phase2Cinematography, 'storyboard.clip.phase2.cine'),
      actingDirections: requireRows(phase2Acting, 'storyboard.clip.phase2.acting'),
    })
    clipPanels.push({
      clipId: params.clip.id,
      clipIndex: params.clipIndex + 1,
      finalPanels,
    })
  }

  const totalPanelCount = clipPanels.reduce((sum, item) => sum + item.finalPanels.length, 0)
  return {
    clipPanels,
    phase1PanelsByClipId,
    phase2CinematographyByClipId,
    phase2ActingByClipId,
    phase3PanelsByClipId,
    totalPanelCount,
    totalStepCount: params.totalClipCount * 4 + 2,
  }
}
