'use client'

import { useEffect, useRef, useState } from 'react'
import type { Character, CharacterAppearance, Location } from '@/types/project'
import type {
  ScriptViewAssetViewMode,
  ScriptViewClip,
  ScriptViewTranslator,
  UpdateClipAssets,
} from './scriptViewAssetPanelTypes'
import {
  confirmCharacterSelection,
  confirmLocationSelection,
  confirmPropSelection,
  hasCharacterLabelChanges,
  hasLocationLabelChanges,
} from './scriptViewAssetPanelSelection'
import {
  useCharacterDraftInitialization,
  useEditorDismissal,
  useLocationDraftInitialization,
  usePropDraftInitialization,
} from './scriptViewAssetPanelDrafts'
import { setsEqual } from './scriptViewAssetPanelUtils'

interface UseScriptViewAssetPanelStateArgs {
  clips: ScriptViewClip[]
  assetViewMode: ScriptViewAssetViewMode
  characters: Character[]
  locations: Location[]
  activeCharIds: string[]
  activeLocationIds: string[]
  activePropIds: string[]
  selectedAppearanceKeys: Set<string>
  getSelectedAppearances: (char: Character) => CharacterAppearance[]
  tAssets: ScriptViewTranslator
  onUpdateClipAssets: UpdateClipAssets
}

export function useScriptViewAssetPanelState({
  clips,
  assetViewMode,
  characters,
  locations,
  activeCharIds,
  activeLocationIds,
  activePropIds,
  selectedAppearanceKeys,
  getSelectedAppearances,
  tAssets,
  onUpdateClipAssets,
}: UseScriptViewAssetPanelStateArgs) {
  const [showAddChar, setShowAddChar] = useState(false)
  const [showAddLoc, setShowAddLoc] = useState(false)
  const [showAddProp, setShowAddProp] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [initialAppearanceKeys, setInitialAppearanceKeys] = useState<Set<string>>(new Set())
  const [pendingAppearanceKeys, setPendingAppearanceKeys] = useState<Set<string>>(new Set())
  const [pendingAppearanceLabels, setPendingAppearanceLabels] = useState<Record<string, string>>(
    {},
  )
  const [pendingLocationIds, setPendingLocationIds] = useState<Set<string>>(new Set())
  const [pendingLocationLabels, setPendingLocationLabels] = useState<Record<string, string>>({})
  const [initialLocationLabels, setInitialLocationLabels] = useState<Record<string, string>>({})
  const [pendingPropIds, setPendingPropIds] = useState<Set<string>>(new Set())
  const [isSavingCharacterSelection, setIsSavingCharacterSelection] = useState(false)
  const [isSavingLocationSelection, setIsSavingLocationSelection] = useState(false)
  const [isSavingPropSelection, setIsSavingPropSelection] = useState(false)

  const charEditorTriggerRef = useRef<HTMLButtonElement | null>(null)
  const charEditorPopoverRef = useRef<HTMLDivElement | null>(null)
  const locEditorTriggerRef = useRef<HTMLButtonElement | null>(null)
  const locEditorPopoverRef = useRef<HTMLDivElement | null>(null)
  const propEditorTriggerRef = useRef<HTMLButtonElement | null>(null)
  const propEditorPopoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useCharacterDraftInitialization({
    showAddChar,
    activeCharIds,
    characters,
    getSelectedAppearances,
    selectedAppearanceKeys,
    tAssets,
    setInitialAppearanceKeys,
    setPendingAppearanceKeys,
    setPendingAppearanceLabels,
  })

  useLocationDraftInitialization({
    showAddLoc,
    activeLocationIds,
    locations,
    assetViewMode,
    clips,
    setPendingLocationIds,
    setPendingLocationLabels,
    setInitialLocationLabels,
  })

  usePropDraftInitialization({
    showAddProp,
    activePropIds,
    setPendingPropIds,
  })

  useEditorDismissal({
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
  })

  const isAllClipsMode = assetViewMode === 'all'
  const hasCharacterSelectionChanges =
    !setsEqual(initialAppearanceKeys, pendingAppearanceKeys) ||
    hasCharacterLabelChanges({
      isAllClipsMode,
      pendingAppearanceKeys,
      pendingAppearanceLabels,
    })
  const hasLocationSelectionChanges =
    !setsEqual(new Set(activeLocationIds), pendingLocationIds) ||
    hasLocationLabelChanges({
      isAllClipsMode,
      pendingLocationIds,
      locations,
      initialLocationLabels,
      pendingLocationLabels,
    })
  const hasPropSelectionChanges = !setsEqual(new Set(activePropIds), pendingPropIds)

  const handleConfirmCharacterSelection = async () => {
    if (isSavingCharacterSelection) return
    setIsSavingCharacterSelection(true)
    try {
      await confirmCharacterSelection({
        initialAppearanceKeys,
        pendingAppearanceKeys,
        pendingAppearanceLabels,
        isAllClipsMode,
        onUpdateClipAssets,
      })
      setShowAddChar(false)
    } finally {
      setIsSavingCharacterSelection(false)
    }
  }

  const handleConfirmLocationSelection = async () => {
    if (isSavingLocationSelection) return
    setIsSavingLocationSelection(true)
    try {
      await confirmLocationSelection({
        activeLocationIds,
        pendingLocationIds,
        pendingLocationLabels,
        initialLocationLabels,
        locations,
        isAllClipsMode,
        onUpdateClipAssets,
      })
      setShowAddLoc(false)
    } finally {
      setIsSavingLocationSelection(false)
    }
  }

  const handleConfirmPropSelection = async () => {
    if (isSavingPropSelection) return
    setIsSavingPropSelection(true)
    try {
      await confirmPropSelection({
        activePropIds,
        pendingPropIds,
        onUpdateClipAssets,
      })
      setShowAddProp(false)
    } finally {
      setIsSavingPropSelection(false)
    }
  }

  return {
    showAddChar,
    setShowAddChar,
    showAddLoc,
    setShowAddLoc,
    showAddProp,
    setShowAddProp,
    mounted,
    charEditorTriggerRef,
    charEditorPopoverRef,
    locEditorTriggerRef,
    locEditorPopoverRef,
    propEditorTriggerRef,
    propEditorPopoverRef,
    pendingAppearanceKeys,
    setPendingAppearanceKeys,
    pendingAppearanceLabels,
    setPendingAppearanceLabels,
    pendingLocationIds,
    setPendingLocationIds,
    pendingLocationLabels,
    setPendingLocationLabels,
    pendingPropIds,
    setPendingPropIds,
    isSavingCharacterSelection,
    isSavingLocationSelection,
    isSavingPropSelection,
    isAllClipsMode,
    hasCharacterSelectionChanges,
    hasLocationSelectionChanges,
    hasPropSelectionChanges,
    handleConfirmCharacterSelection,
    handleConfirmLocationSelection,
    handleConfirmPropSelection,
  }
}
