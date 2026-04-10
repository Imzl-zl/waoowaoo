import type { Location } from '@/types/project'
import type { UpdateClipAssets } from './scriptViewAssetPanelTypes'
import { parseAppearanceKey, readTrimmedLabel } from './scriptViewAssetPanelUtils'

type CharacterLabelChangesOptions = {
  isAllClipsMode: boolean
  pendingAppearanceKeys: Set<string>
  pendingAppearanceLabels: Record<string, string>
}

type LocationLabelChangesOptions = {
  isAllClipsMode: boolean
  pendingLocationIds: Set<string>
  locations: Location[]
  initialLocationLabels: Record<string, string>
  pendingLocationLabels: Record<string, string>
}

type ConfirmCharacterSelectionOptions = {
  initialAppearanceKeys: Set<string>
  pendingAppearanceKeys: Set<string>
  pendingAppearanceLabels: Record<string, string>
  isAllClipsMode: boolean
  onUpdateClipAssets: UpdateClipAssets
}

type ConfirmLocationSelectionOptions = {
  activeLocationIds: string[]
  pendingLocationIds: Set<string>
  pendingLocationLabels: Record<string, string>
  initialLocationLabels: Record<string, string>
  locations: Location[]
  isAllClipsMode: boolean
  onUpdateClipAssets: UpdateClipAssets
}

type ConfirmPropSelectionOptions = {
  activePropIds: string[]
  pendingPropIds: Set<string>
  onUpdateClipAssets: UpdateClipAssets
}

export function hasCharacterLabelChanges({
  isAllClipsMode,
  pendingAppearanceKeys,
  pendingAppearanceLabels,
}: CharacterLabelChangesOptions): boolean {
  if (isAllClipsMode) return false

  return Array.from(pendingAppearanceKeys).some((key) => {
    const parsed = parseAppearanceKey(key)
    if (!parsed) return false
    const nextLabel = readTrimmedLabel(pendingAppearanceLabels[key], parsed.appearanceName)
    return nextLabel !== parsed.appearanceName
  })
}

export function hasLocationLabelChanges({
  isAllClipsMode,
  pendingLocationIds,
  locations,
  initialLocationLabels,
  pendingLocationLabels,
}: LocationLabelChangesOptions): boolean {
  if (isAllClipsMode) return false

  return Array.from(pendingLocationIds).some((locationId) => {
    const location = locations.find((item) => item.id === locationId)
    if (!location) return false
    const baseLabel = initialLocationLabels[locationId] || location.name
    const nextLabel = readTrimmedLabel(pendingLocationLabels[locationId], location.name)
    return nextLabel !== baseLabel
  })
}

export async function confirmCharacterSelection({
  initialAppearanceKeys,
  pendingAppearanceKeys,
  pendingAppearanceLabels,
  isAllClipsMode,
  onUpdateClipAssets,
}: ConfirmCharacterSelectionOptions) {
  const currentKeys = new Set(initialAppearanceKeys)
  const desiredKeys = new Set<string>()
  const desiredItems: Array<{
    characterId: string
    appearanceName: string
    targetKey: string
  }> = []

  pendingAppearanceKeys.forEach((rawKey) => {
    const parsed = parseAppearanceKey(rawKey)
    if (!parsed) return

    const appearanceName = isAllClipsMode
      ? parsed.appearanceName
      : readTrimmedLabel(pendingAppearanceLabels[rawKey], parsed.appearanceName)
    const targetKey = `${parsed.characterId}::${appearanceName}`
    if (desiredKeys.has(targetKey)) return

    desiredKeys.add(targetKey)
    desiredItems.push({
      characterId: parsed.characterId,
      appearanceName,
      targetKey,
    })
  })

  for (const key of currentKeys) {
    if (desiredKeys.has(key)) continue
    const parsed = parseAppearanceKey(key)
    if (!parsed) continue
    await onUpdateClipAssets('character', 'remove', parsed.characterId, parsed.appearanceName)
  }

  for (const item of desiredItems) {
    if (currentKeys.has(item.targetKey)) continue
    await onUpdateClipAssets('character', 'add', item.characterId, item.appearanceName)
  }
}

export async function confirmLocationSelection({
  activeLocationIds,
  pendingLocationIds,
  pendingLocationLabels,
  initialLocationLabels,
  locations,
  isAllClipsMode,
  onUpdateClipAssets,
}: ConfirmLocationSelectionOptions) {
  const currentIds = new Set(activeLocationIds)

  for (const locationId of currentIds) {
    if (pendingLocationIds.has(locationId)) continue
    await onUpdateClipAssets('location', 'remove', locationId)
  }

  for (const locationId of pendingLocationIds) {
    const location = locations.find((item) => item.id === locationId)
    if (!location) continue

    const nextLabel = isAllClipsMode
      ? location.name
      : readTrimmedLabel(pendingLocationLabels[locationId], location.name)
    const baseLabel = initialLocationLabels[locationId] || location.name
    const changedLabel = currentIds.has(locationId) && nextLabel !== baseLabel

    if (changedLabel) {
      await onUpdateClipAssets('location', 'remove', locationId)
      await onUpdateClipAssets('location', 'add', locationId, nextLabel)
      continue
    }

    if (!currentIds.has(locationId)) {
      await onUpdateClipAssets('location', 'add', locationId, nextLabel)
    }
  }
}

export async function confirmPropSelection({
  activePropIds,
  pendingPropIds,
  onUpdateClipAssets,
}: ConfirmPropSelectionOptions) {
  const currentIds = new Set(activePropIds)

  for (const propId of currentIds) {
    if (pendingPropIds.has(propId)) continue
    await onUpdateClipAssets('prop', 'remove', propId)
  }

  for (const propId of pendingPropIds) {
    if (currentIds.has(propId)) continue
    await onUpdateClipAssets('prop', 'add', propId)
  }
}
