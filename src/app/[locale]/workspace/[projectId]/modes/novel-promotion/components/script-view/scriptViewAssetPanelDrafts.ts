'use client'

import { useEffect, useRef } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Character, CharacterAppearance, Location } from '@/types/project'
import { fuzzyMatchLocation } from './clip-asset-utils'
import type {
  ScriptViewAssetViewMode,
  ScriptViewClip,
  ScriptViewTranslator,
} from './scriptViewAssetPanelTypes'
import { parseAppearanceKey, parseLocationNames } from './scriptViewAssetPanelUtils'

type SetStringSet = Dispatch<SetStateAction<Set<string>>>
type SetStringRecord = Dispatch<SetStateAction<Record<string, string>>>

type CharacterDraftInitOptions = {
  showAddChar: boolean
  activeCharIds: string[]
  characters: Character[]
  getSelectedAppearances: (char: Character) => CharacterAppearance[]
  selectedAppearanceKeys: Set<string>
  tAssets: ScriptViewTranslator
  setInitialAppearanceKeys: SetStringSet
  setPendingAppearanceKeys: SetStringSet
  setPendingAppearanceLabels: SetStringRecord
}

type LocationDraftInitOptions = {
  showAddLoc: boolean
  activeLocationIds: string[]
  locations: Location[]
  assetViewMode: ScriptViewAssetViewMode
  clips: ScriptViewClip[]
  setPendingLocationIds: SetStringSet
  setPendingLocationLabels: SetStringRecord
  setInitialLocationLabels: SetStringRecord
}

type PropDraftInitOptions = {
  showAddProp: boolean
  activePropIds: string[]
  setPendingPropIds: SetStringSet
}

type EditorDismissalOptions = {
  showAddChar: boolean
  setShowAddChar: Dispatch<SetStateAction<boolean>>
  showAddLoc: boolean
  setShowAddLoc: Dispatch<SetStateAction<boolean>>
  showAddProp: boolean
  setShowAddProp: Dispatch<SetStateAction<boolean>>
  charEditorTriggerRef: RefObject<HTMLButtonElement | null>
  charEditorPopoverRef: RefObject<HTMLDivElement | null>
  locEditorTriggerRef: RefObject<HTMLButtonElement | null>
  locEditorPopoverRef: RefObject<HTMLDivElement | null>
  propEditorTriggerRef: RefObject<HTMLButtonElement | null>
  propEditorPopoverRef: RefObject<HTMLDivElement | null>
}

export function useCharacterDraftInitialization({
  showAddChar,
  activeCharIds,
  characters,
  getSelectedAppearances,
  selectedAppearanceKeys,
  tAssets,
  setInitialAppearanceKeys,
  setPendingAppearanceKeys,
  setPendingAppearanceLabels,
}: CharacterDraftInitOptions) {
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (!showAddChar) {
      hasInitializedRef.current = false
      return
    }
    if (hasInitializedRef.current) return

    const nextKeys = new Set(selectedAppearanceKeys)
    const nextLabels: Record<string, string> = {}

    nextKeys.forEach((key) => {
      const parsed = parseAppearanceKey(key)
      if (parsed) nextLabels[key] = parsed.appearanceName
    })

    activeCharIds.forEach((characterId) => {
      const character = characters.find((item) => item.id === characterId)
      if (!character) return

      getSelectedAppearances(character).forEach((appearance) => {
        const appearanceName = appearance.changeReason || tAssets('character.primary')
        const appearanceKey = `${character.id}::${appearanceName}`
        nextKeys.add(appearanceKey)
        if (!nextLabels[appearanceKey]) {
          nextLabels[appearanceKey] = appearanceName
        }
      })
    })

    const baselineKeys = new Set(nextKeys)
    setInitialAppearanceKeys(baselineKeys)
    setPendingAppearanceKeys(baselineKeys)
    setPendingAppearanceLabels(nextLabels)
    hasInitializedRef.current = true
  }, [
    activeCharIds,
    characters,
    getSelectedAppearances,
    selectedAppearanceKeys,
    setInitialAppearanceKeys,
    setPendingAppearanceKeys,
    setPendingAppearanceLabels,
    showAddChar,
    tAssets,
  ])
}

export function useLocationDraftInitialization({
  showAddLoc,
  activeLocationIds,
  locations,
  assetViewMode,
  clips,
  setPendingLocationIds,
  setPendingLocationLabels,
  setInitialLocationLabels,
}: LocationDraftInitOptions) {
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (!showAddLoc) {
      hasInitializedRef.current = false
      return
    }
    if (hasInitializedRef.current) return

    const nextIds = new Set(activeLocationIds)
    const nextLabels: Record<string, string> = {}

    activeLocationIds.forEach((locationId) => {
      const location = locations.find((item) => item.id === locationId)
      if (location) nextLabels[locationId] = location.name
    })

    if (assetViewMode !== 'all') {
      const currentClip = clips.find((clip) => clip.id === assetViewMode)
      const rawLocationNames = parseLocationNames(currentClip?.location)

      activeLocationIds.forEach((locationId) => {
        const location = locations.find((item) => item.id === locationId)
        if (!location) return
        const matchedRawName = rawLocationNames.find((name) =>
          fuzzyMatchLocation(name, location.name),
        )
        if (matchedRawName) {
          nextLabels[locationId] = matchedRawName
        }
      })
    }

    setPendingLocationIds(nextIds)
    setPendingLocationLabels(nextLabels)
    setInitialLocationLabels(nextLabels)
    hasInitializedRef.current = true
  }, [
    activeLocationIds,
    assetViewMode,
    clips,
    locations,
    setInitialLocationLabels,
    setPendingLocationIds,
    setPendingLocationLabels,
    showAddLoc,
  ])
}

export function usePropDraftInitialization({
  showAddProp,
  activePropIds,
  setPendingPropIds,
}: PropDraftInitOptions) {
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (!showAddProp) {
      hasInitializedRef.current = false
      return
    }
    if (hasInitializedRef.current) return

    setPendingPropIds(new Set(activePropIds))
    hasInitializedRef.current = true
  }, [activePropIds, setPendingPropIds, showAddProp])
}

export function useEditorDismissal({
  showAddChar,
  setShowAddChar,
  showAddLoc,
  setShowAddLoc,
  showAddProp,
  setShowAddProp,
  charEditorTriggerRef,
  charEditorPopoverRef,
  locEditorTriggerRef,
  locEditorPopoverRef,
  propEditorTriggerRef,
  propEditorPopoverRef,
}: EditorDismissalOptions) {
  useEffect(() => {
    if (!showAddChar && !showAddLoc && !showAddProp) return

    const handlePointerDownOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (
        showAddChar &&
        !charEditorPopoverRef.current?.contains(target) &&
        !charEditorTriggerRef.current?.contains(target)
      ) {
        setShowAddChar(false)
      }

      if (
        showAddLoc &&
        !locEditorPopoverRef.current?.contains(target) &&
        !locEditorTriggerRef.current?.contains(target)
      ) {
        setShowAddLoc(false)
      }

      if (
        showAddProp &&
        !propEditorPopoverRef.current?.contains(target) &&
        !propEditorTriggerRef.current?.contains(target)
      ) {
        setShowAddProp(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (showAddChar) setShowAddChar(false)
      if (showAddLoc) setShowAddLoc(false)
      if (showAddProp) setShowAddProp(false)
    }

    document.addEventListener('mousedown', handlePointerDownOutside, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    charEditorPopoverRef,
    charEditorTriggerRef,
    locEditorPopoverRef,
    locEditorTriggerRef,
    propEditorPopoverRef,
    propEditorTriggerRef,
    setShowAddChar,
    setShowAddLoc,
    setShowAddProp,
    showAddChar,
    showAddLoc,
    showAddProp,
  ])
}
