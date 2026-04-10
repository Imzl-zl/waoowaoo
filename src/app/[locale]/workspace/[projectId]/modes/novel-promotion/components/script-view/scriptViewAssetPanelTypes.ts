import type { Character, CharacterAppearance, Location, Prop } from '@/types/project'
import type { TaskPresentationState } from '@/lib/task/presentation'

export interface ScriptViewClip {
  id: string
  location?: string | null
  props?: string | null
}

export type ScriptViewAssetViewMode = 'all' | string

export type ScriptViewTranslator = (key: string, values?: Record<string, unknown>) => string

export type UpdateClipAssets = (
  type: 'character' | 'location' | 'prop',
  action: 'add' | 'remove',
  id: string,
  optionLabel?: string,
) => Promise<void>

export interface ScriptViewAssetsPanelProps {
  clips: ScriptViewClip[]
  assetViewMode: ScriptViewAssetViewMode
  setAssetViewMode: (mode: ScriptViewAssetViewMode) => void
  setSelectedClipId: (clipId: string) => void
  characters: Character[]
  locations: Location[]
  props: Prop[]
  activeCharIds: string[]
  activeLocationIds: string[]
  activePropIds: string[]
  selectedAppearanceKeys: Set<string>
  onUpdateClipAssets: UpdateClipAssets
  onOpenAssetLibrary?: () => void
  assetsLoading: boolean
  assetsLoadingState: TaskPresentationState | null
  allAssetsHaveImages: boolean
  globalCharIds: string[]
  globalLocationIds: string[]
  globalPropIds: string[]
  missingAssetsCount: number
  onGenerateStoryboard?: () => void
  isSubmittingStoryboardBuild: boolean
  getSelectedAppearances: (char: Character) => CharacterAppearance[]
  tScript: ScriptViewTranslator
  tAssets: ScriptViewTranslator
  tNP: ScriptViewTranslator
  tCommon: ScriptViewTranslator
}
