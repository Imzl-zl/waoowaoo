import { logError as _ulogError } from '@/lib/logging/core'
import { executeAiTextStep } from '@/lib/ai-runtime'
import { buildCharactersIntroduction } from '@/lib/constants'
import type { Locale } from '@/i18n/routing'
import {
  buildPromptAssetContext,
  compileAssetPromptFragments,
} from '@/lib/assets/services/asset-prompt-context'

export type StoryboardPhase = 1 | '2-cinematography' | '2-acting' | 3

export type JsonRecord = Record<string, unknown>
export type ClipCharacterRef = string | { name?: string | null }

type CharacterAppearance = {
  changeReason?: string | null
  descriptions?: string | null
  selectedIndex?: number | null
  description?: string | null
}

export type CharacterAsset = {
  name: string
  appearances?: CharacterAppearance[]
}

export type LocationAsset = {
  name: string
  images?: Array<{
    isSelected?: boolean
    description?: string | null
  }>
}

export type PropAsset = {
  name: string
  summary?: string | null
}

export type ClipAsset = {
  id?: string
  start?: string | number | null
  end?: string | number | null
  startText?: string | null
  endText?: string | null
  characters?: string | null
  location?: string | null
  props?: string | null
  content?: string | null
  screenplay?: string | null
}

export type SessionAsset = {
  user: {
    id: string
    name: string
  }
}

export type NovelPromotionAssetData = {
  analysisModel: string
  characters: CharacterAsset[]
  locations: LocationAsset[]
  props?: PropAsset[]
}

export type StoryboardPanel = JsonRecord & {
  panel_number?: number
  description?: string
  location?: string
  source_text?: string
  characters?: unknown
  props?: unknown
  srt_range?: unknown[]
  scene_type?: string
  shot_type?: string
  camera_move?: string
  video_prompt?: string
  duration?: number
  photographyPlan?: JsonRecord
  actingNotes?: unknown
}

export type PhotographyRule = JsonRecord & {
  panel_number?: number
  composition?: string
  lighting?: string
  color_palette?: string
  atmosphere?: string
  technical_notes?: string
}

export type ActingDirection = JsonRecord & {
  panel_number?: number
  characters?: unknown
}

export interface PhaseResult {
  clipId: string
  planPanels?: StoryboardPanel[]
  photographyRules?: PhotographyRule[]
  actingDirections?: ActingDirection[]
  finalPanels?: StoryboardPanel[]
}

export const PHASE_PROGRESS: Record<string, { start: number; end: number; label: string; labelKey: string }> = {
  '1': { start: 10, end: 40, label: '规划分镜', labelKey: 'phases.planning' },
  '2-cinematography': { start: 40, end: 55, label: '设计摄影', labelKey: 'phases.cinematography' },
  '2-acting': { start: 55, end: 70, label: '设计演技', labelKey: 'phases.acting' },
  '3': { start: 70, end: 100, label: '补充细节', labelKey: 'phases.detail' },
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

export function parseClipCharacters(raw: string | null | undefined): ClipCharacterRef[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ClipCharacterRef[]) : []
  } catch {
    return []
  }
}

export function parseScreenplay(raw: string | null | undefined): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function parseClipProps(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
  } catch {
    return []
  }
}

export function getFilteredAppearanceList(characters: CharacterAsset[], clipCharacters: ClipCharacterRef[]): string {
  return compileAssetPromptFragments(buildPromptAssetContext({
    characters,
    locations: [],
    props: [],
    clipCharacters,
    clipLocation: null,
    clipProps: [],
  })).appearanceListText
}

export function getFilteredFullDescription(characters: CharacterAsset[], clipCharacters: ClipCharacterRef[]): string {
  return compileAssetPromptFragments(buildPromptAssetContext({
    characters,
    locations: [],
    props: [],
    clipCharacters,
    clipLocation: null,
    clipProps: [],
  })).fullDescriptionText
}

export function getFilteredLocationsDescription(
  locations: LocationAsset[],
  clipLocation: string | null,
  locale: Locale = 'zh',
): string {
  return compileAssetPromptFragments(buildPromptAssetContext({
    characters: [],
    locations,
    props: [],
    clipCharacters: [],
    clipLocation,
    clipProps: [],
    locale,
  })).locationDescriptionText
}

export function formatClipId(clip: ClipAsset): string {
  if (clip.start !== undefined && clip.start !== null) {
    return `${clip.start}-${clip.end}`
  }
  if (clip.startText && clip.endText) {
    return `${clip.startText.substring(0, 10)}...~...${clip.endText.substring(0, 10)}`
  }
  return clip.id?.substring(0, 8) || 'unknown'
}

export function parseJsonResponse<T extends JsonRecord>(responseText: string, clipId: string, phase: number): T[] {
  let jsonText = responseText.trim()
  jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')

  const firstBracket = jsonText.indexOf('[')
  const lastBracket = jsonText.lastIndexOf(']')
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    throw new Error(`Phase ${phase}: JSON格式错误 clip ${clipId}`)
  }

  jsonText = jsonText.substring(firstBracket, lastBracket + 1)
  const result = JSON.parse(jsonText)
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(`Phase ${phase}: 返回空数据 clip ${clipId}`)
  }

  const normalized = result.filter(isJsonRecord) as T[]
  if (normalized.length === 0) {
    throw new Error(`Phase ${phase}: 数据结构错误 clip ${clipId}`)
  }
  return normalized
}

export function buildStoryboardClipContext(clip: ClipAsset) {
  return {
    clipCharacters: parseClipCharacters(clip.characters),
    clipLocation: clip.location || null,
    clipProps: parseClipProps(clip.props),
  }
}

export function buildStoryboardAssetPromptData(input: {
  novelPromotionData: NovelPromotionAssetData
  clipCharacters: ClipCharacterRef[]
  clipLocation: string | null
  clipProps: string[]
  locale: Locale
}) {
  return {
    charactersLibName: input.novelPromotionData.characters.map((character) => character.name).join(', ') || '无',
    locationsLibName: input.novelPromotionData.locations.map((location) => location.name).join(', ') || '无',
    filteredAppearanceList: getFilteredAppearanceList(input.novelPromotionData.characters, input.clipCharacters),
    filteredFullDescription: getFilteredFullDescription(input.novelPromotionData.characters, input.clipCharacters),
    filteredLocationsDescription: getFilteredLocationsDescription(
      input.novelPromotionData.locations,
      input.clipLocation,
      input.locale,
    ),
    filteredPropsDescription: compileAssetPromptFragments(buildPromptAssetContext({
      characters: [],
      locations: [],
      props: input.novelPromotionData.props || [],
      clipCharacters: [],
      clipLocation: null,
      clipProps: input.clipProps,
    })).propsDescriptionText,
    charactersIntroduction: buildCharactersIntroduction(input.novelPromotionData.characters),
  }
}

export function buildStoryboardClipJson(input: {
  clip: ClipAsset
  clipCharacters: ClipCharacterRef[]
  clipLocation: string | null
  clipProps: string[]
}) {
  return JSON.stringify({
    id: input.clip.id,
    content: input.clip.content,
    characters: input.clipCharacters,
    location: input.clipLocation,
    props: input.clipProps,
  }, null, 2)
}

export async function executeStoryboardArrayPhase<T extends JsonRecord>(input: {
  phaseLabel: string
  phaseNumber: number
  clipId: string
  userId: string
  model: string
  prompt: string
  projectId: string
  action: string
  stepTitle: string
  afterParse?: (items: T[], attempt: number) => T[]
}): Promise<T[]> {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await executeAiTextStep({
        userId: input.userId,
        model: input.model,
        messages: [{ role: 'user', content: input.prompt }],
        reasoning: true,
        projectId: input.projectId,
        action: input.action,
        meta: {
          stepId: input.action,
          stepTitle: input.stepTitle,
          stepIndex: 1,
          stepTotal: 1,
        },
      })
      const responseText = result.text
      if (!responseText) {
        throw new Error(`${input.phaseLabel}: 无响应 clip ${input.clipId}`)
      }

      const parsed = parseJsonResponse<T>(responseText, input.clipId, input.phaseNumber)
      return input.afterParse ? input.afterParse(parsed, attempt) : parsed
    } catch (error: unknown) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      _ulogError(`[${input.phaseLabel}] Clip ${input.clipId}: 第${attempt}次尝试失败: ${message}`)
      if (attempt === 2) throw error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${input.phaseLabel}: 未知失败 clip ${input.clipId}`)
}
