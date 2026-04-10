import { logInfo as _ulogInfo, logWarn as _ulogWarn } from '@/lib/logging/core'
/**
 * 分镜生成多阶段处理器
 * 将分镜生成拆分为3个独立阶段，每阶段控制在Vercel时间限制内
 * 
 * 每个阶段失败后重试一次
 */

import { logAIAnalysis } from '@/lib/logging/semantic'
import type { Locale } from '@/i18n/routing'
import { getPromptTemplate, PROMPT_IDS } from '@/lib/prompt-i18n'
import {
  buildStoryboardAssetPromptData,
  buildStoryboardClipContext,
  buildStoryboardClipJson,
  executeStoryboardArrayPhase,
  formatClipId,
  parseScreenplay,
} from './storyboard-phase-shared'
import type {
  ActingDirection,
  ClipAsset,
  NovelPromotionAssetData,
  PhaseResult,
  PhotographyRule,
  SessionAsset,
  StoryboardPanel,
} from './storyboard-phase-shared'

export {
  PHASE_PROGRESS,
  formatClipId,
  getFilteredAppearanceList,
  getFilteredFullDescription,
  getFilteredLocationsDescription,
} from './storyboard-phase-shared'
export type {
  ActingDirection,
  CharacterAsset,
  ClipAsset,
  ClipCharacterRef,
  LocationAsset,
  NovelPromotionAssetData,
  PhaseResult,
  PhotographyRule,
  PropAsset,
  SessionAsset,
  StoryboardPanel,
  StoryboardPhase,
} from './storyboard-phase-shared'

// ========== Phase 1: 基础分镜规划 ==========
export async function executePhase1(
  clip: ClipAsset,
  novelPromotionData: NovelPromotionAssetData,
  session: SessionAsset,
  projectId: string,
  projectName: string,
  locale: Locale,
  taskId?: string,
): Promise<PhaseResult> {
  const clipId = formatClipId(clip)
  void taskId
  _ulogInfo(`[Phase 1] Clip ${clipId}: 开始基础分镜规划...`)

  const planPromptTemplate = getPromptTemplate(PROMPT_IDS.NP_AGENT_STORYBOARD_PLAN, locale)
  const { clipCharacters, clipLocation, clipProps } = buildStoryboardClipContext(clip)
  const assetPromptData = buildStoryboardAssetPromptData({
    novelPromotionData,
    clipCharacters,
    clipLocation,
    clipProps,
    locale,
  })
  const clipJson = buildStoryboardClipJson({ clip, clipCharacters, clipLocation, clipProps })
  const screenplay = parseScreenplay(clip.screenplay)
  if (clip.screenplay && !screenplay) {
    _ulogWarn(`[Phase 1] Clip ${clipId}: 剧本JSON解析失败`)
  }

  let planPrompt = planPromptTemplate
    .replace('{characters_lib_name}', assetPromptData.charactersLibName)
    .replace('{locations_lib_name}', assetPromptData.locationsLibName)
    .replace('{characters_introduction}', assetPromptData.charactersIntroduction)
    .replace('{characters_appearance_list}', assetPromptData.filteredAppearanceList)
    .replace('{characters_full_description}', assetPromptData.filteredFullDescription)
    .replace('{props_description}', assetPromptData.filteredPropsDescription)
    .replace('{clip_json}', clipJson)

  if (screenplay) {
    planPrompt = planPrompt.replace('{clip_content}', `【剧本格式】\n${JSON.stringify(screenplay, null, 2)}`)
  } else {
    planPrompt = planPrompt.replace('{clip_content}', clip.content || '')
  }

  logAIAnalysis(session.user.id, session.user.name, projectId, projectName, {
    action: 'STORYBOARD_PHASE1_PROMPT',
    input: { 片段标识: clipId, 完整提示词: planPrompt },
    model: novelPromotionData.analysisModel,
  })

  const planPanels = await executeStoryboardArrayPhase<StoryboardPanel>({
    phaseLabel: 'Phase 1',
    phaseNumber: 1,
    clipId,
    userId: session.user.id,
    model: novelPromotionData.analysisModel,
    prompt: planPrompt,
    projectId,
    action: 'storyboard_phase1_plan',
    stepTitle: '分镜规划',
    afterParse: (panels, attempt) => {
      const validPanelCount = panels.filter((panel) =>
        panel.description && panel.description !== '无' && panel.location !== '无',
      ).length
      _ulogInfo(`[Phase 1] Clip ${clipId}: 共 ${panels.length} 个分镜，其中 ${validPanelCount} 个有效分镜`)
      if (validPanelCount === 0) {
        throw new Error(`Phase 1: 返回全部为空分镜 clip ${clipId}`)
      }
      if (panels.some((panel) => !panel.source_text) && attempt === 1) {
        _ulogWarn(`[Phase 1] Clip ${clipId}: 有分镜缺少source_text，尝试重试...`)
        throw new Error(`Phase 1: source_text missing clip ${clipId}`)
      }
      return panels
    },
  })

  logAIAnalysis(session.user.id, session.user.name, projectId, projectName, {
    action: 'STORYBOARD_PHASE1_OUTPUT',
    output: {
      片段标识: clipId,
      总分镜数: planPanels.length,
      第一阶段完整结果: planPanels,
    },
    model: novelPromotionData.analysisModel,
  })
  _ulogInfo(`[Phase 1] Clip ${clipId}: 生成 ${planPanels.length} 个基础分镜`)

  return { clipId, planPanels }
}

// ========== Phase 2: 摄影规则生成 ==========
export async function executePhase2(
  clip: ClipAsset,
  planPanels: StoryboardPanel[],
  novelPromotionData: NovelPromotionAssetData,
  session: SessionAsset,
  projectId: string,
  projectName: string,
  locale: Locale,
  taskId?: string,
): Promise<PhaseResult> {
  const clipId = formatClipId(clip)
  void taskId
  _ulogInfo(`[Phase 2] Clip ${clipId}: 开始生成摄影规则...`)

  const cinematographerPromptTemplate = getPromptTemplate(PROMPT_IDS.NP_AGENT_CINEMATOGRAPHER, locale)
  const { clipCharacters, clipLocation, clipProps } = buildStoryboardClipContext(clip)
  const assetPromptData = buildStoryboardAssetPromptData({
    novelPromotionData,
    clipCharacters,
    clipLocation,
    clipProps,
    locale,
  })

  const cinematographerPrompt = cinematographerPromptTemplate
    .replace('{panels_json}', JSON.stringify(planPanels, null, 2))
    .replace('{panel_count}', planPanels.length.toString())
    .replace(/\{panel_count\}/g, planPanels.length.toString())
    .replace('{locations_description}', assetPromptData.filteredLocationsDescription)
    .replace('{characters_info}', assetPromptData.filteredFullDescription)
    .replace('{props_description}', assetPromptData.filteredPropsDescription)

  const photographyRules = await executeStoryboardArrayPhase<PhotographyRule>({
    phaseLabel: 'Phase 2',
    phaseNumber: 2,
    clipId,
    userId: session.user.id,
    model: novelPromotionData.analysisModel,
    prompt: cinematographerPrompt,
    projectId,
    action: 'storyboard_phase2_cinematography',
    stepTitle: '摄影规则',
  })

  _ulogInfo(`[Phase 2] Clip ${clipId}: 成功生成 ${photographyRules.length} 个镜头的摄影规则`)
  logAIAnalysis(session.user.id, session.user.name, projectId, projectName, {
    action: 'CINEMATOGRAPHER_PLAN',
    output: {
      片段标识: clipId,
      镜头数量: planPanels.length,
      摄影规则数量: photographyRules.length,
      摄影规则: photographyRules,
    },
    model: novelPromotionData.analysisModel,
  })

  return { clipId, planPanels, photographyRules }
}

// ========== Phase 2-Acting: 演技指导生成 ==========
export async function executePhase2Acting(
  clip: ClipAsset,
  planPanels: StoryboardPanel[],
  novelPromotionData: NovelPromotionAssetData,
  session: SessionAsset,
  projectId: string,
  projectName: string,
  locale: Locale,
  taskId?: string,
): Promise<PhaseResult> {
  const clipId = formatClipId(clip)
  void taskId
  _ulogInfo(`[Phase 2-Acting] ==========================================`)
  _ulogInfo(`[Phase 2-Acting] Clip ${clipId}: 开始生成演技指导...`)
  _ulogInfo(`[Phase 2-Acting] planPanels 数量: ${planPanels.length}`)
  _ulogInfo(`[Phase 2-Acting] projectId: ${projectId}, projectName: ${projectName}`)

  const actingPromptTemplate = getPromptTemplate(PROMPT_IDS.NP_AGENT_ACTING_DIRECTION, locale)
  const { clipCharacters } = buildStoryboardClipContext(clip)
  const assetPromptData = buildStoryboardAssetPromptData({
    novelPromotionData,
    clipCharacters,
    clipLocation: null,
    clipProps: [],
    locale,
  })

  const actingPrompt = actingPromptTemplate
    .replace('{panels_json}', JSON.stringify(planPanels, null, 2))
    .replace('{panel_count}', planPanels.length.toString())
    .replace(/\{panel_count\}/g, planPanels.length.toString())
    .replace('{characters_info}', assetPromptData.filteredFullDescription)

  const actingDirections = await executeStoryboardArrayPhase<ActingDirection>({
    phaseLabel: 'Phase 2-Acting',
    phaseNumber: 2,
    clipId,
    userId: session.user.id,
    model: novelPromotionData.analysisModel,
    prompt: actingPrompt,
    projectId,
    action: 'storyboard_phase2_acting',
    stepTitle: '演技指导',
  })

  _ulogInfo(`[Phase 2-Acting] Clip ${clipId}: 成功生成 ${actingDirections.length} 个镜头的演技指导`)
  logAIAnalysis(session.user.id, session.user.name, projectId, projectName, {
    action: 'ACTING_DIRECTION_PLAN',
    output: {
      片段标识: clipId,
      镜头数量: planPanels.length,
      演技指导数量: actingDirections.length,
      演技指导: actingDirections,
    },
    model: novelPromotionData.analysisModel,
  })

  return { clipId, planPanels, actingDirections }
}

// ========== Phase 3: 补充细节和video_prompt ==========
export async function executePhase3(
  clip: ClipAsset,
  planPanels: StoryboardPanel[],
  photographyRules: PhotographyRule[],
  novelPromotionData: NovelPromotionAssetData,
  session: SessionAsset,
  projectId: string,
  projectName: string,
  locale: Locale,
  taskId?: string,
): Promise<PhaseResult> {
  const clipId = formatClipId(clip)
  void taskId
  _ulogInfo(`[Phase 3] Clip ${clipId}: 开始补充镜头细节...`)

  const detailPromptTemplate = getPromptTemplate(PROMPT_IDS.NP_AGENT_STORYBOARD_DETAIL, locale)
  const { clipCharacters, clipLocation, clipProps } = buildStoryboardClipContext(clip)
  const assetPromptData = buildStoryboardAssetPromptData({
    novelPromotionData,
    clipCharacters,
    clipLocation,
    clipProps,
    locale,
  })

  const detailPrompt = detailPromptTemplate
    .replace('{panels_json}', JSON.stringify(planPanels, null, 2))
    .replace('{characters_age_gender}', assetPromptData.filteredFullDescription)
    .replace('{locations_description}', assetPromptData.filteredLocationsDescription)
    .replace('{props_description}', assetPromptData.filteredPropsDescription)

  logAIAnalysis(session.user.id, session.user.name, projectId, projectName, {
    action: 'STORYBOARD_PHASE3_PROMPT',
    input: { 片段标识: clipId, 完整提示词: detailPrompt },
    model: novelPromotionData.analysisModel,
  })

  void photographyRules
  const finalPanels = await executeStoryboardArrayPhase<StoryboardPanel>({
    phaseLabel: 'Phase 3',
    phaseNumber: 3,
    clipId,
    userId: session.user.id,
    model: novelPromotionData.analysisModel,
    prompt: detailPrompt,
    projectId,
    action: 'storyboard_phase3_detail',
    stepTitle: '镜头细化',
    afterParse: (panels) => {
      logAIAnalysis(session.user.id, session.user.name, projectId, projectName, {
        action: 'STORYBOARD_PHASE3_OUTPUT',
        output: {
          片段标识: clipId,
          总分镜数: panels.length,
          第三阶段完整结果_过滤前: panels,
        },
        model: novelPromotionData.analysisModel,
      })

      const filteredPanels = panels.filter((panel) =>
        panel.description && panel.description !== '无' && panel.location !== '无',
      )
      _ulogInfo(`[Phase 3] Clip ${clipId}: 过滤空分镜 ${panels.length} -> ${filteredPanels.length} 个有效分镜`)
      if (filteredPanels.length === 0) {
        throw new Error(`Phase 3: 过滤后无有效分镜 clip ${clipId}`)
      }

      logAIAnalysis(session.user.id, session.user.name, projectId, projectName, {
        action: 'STORYBOARD_FINAL_OUTPUT',
        output: {
          片段标识: clipId,
          过滤前总数: panels.length,
          过滤后有效数: filteredPanels.length,
          最终有效分镜: filteredPanels,
        },
        model: novelPromotionData.analysisModel,
      })
      return filteredPanels
    },
  })

  _ulogInfo(`[Phase 3] Clip ${clipId}: 完成 ${finalPanels.length} 个镜头细节`)
  return { clipId, finalPanels }
}
