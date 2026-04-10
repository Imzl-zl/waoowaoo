'use client'

import { createPortal } from 'react-dom'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Character, CharacterAppearance } from '@/types/project'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import { AppIcon } from '@/components/ui/icons'
import { SpotlightCharCard } from './SpotlightCards'
import type { ScriptViewTranslator, UpdateClipAssets } from './scriptViewAssetPanelTypes'
import { getAppearancePreviewUrl } from './scriptViewAssetPanelUtils'

interface ScriptViewCharactersSectionProps {
  characters: Character[]
  activeCharIds: string[]
  getSelectedAppearances: (char: Character) => CharacterAppearance[]
  onOpenAssetLibrary?: () => void
  onUpdateClipAssets: UpdateClipAssets
  showAddChar: boolean
  setShowAddChar: Dispatch<SetStateAction<boolean>>
  mounted: boolean
  charEditorTriggerRef: RefObject<HTMLButtonElement | null>
  charEditorPopoverRef: RefObject<HTMLDivElement | null>
  pendingAppearanceKeys: Set<string>
  setPendingAppearanceKeys: Dispatch<SetStateAction<Set<string>>>
  pendingAppearanceLabels: Record<string, string>
  setPendingAppearanceLabels: Dispatch<SetStateAction<Record<string, string>>>
  isAllClipsMode: boolean
  isSavingCharacterSelection: boolean
  hasCharacterSelectionChanges: boolean
  handleConfirmCharacterSelection: () => Promise<void>
  onToggleEditor: () => void
  tScript: ScriptViewTranslator
  tAssets: ScriptViewTranslator
  tCommon: ScriptViewTranslator
}

function getSelectedAppearanceCount(
  characters: Character[],
  activeCharIds: string[],
  getSelectedAppearances: (char: Character) => CharacterAppearance[],
): number {
  return characters
    .filter((character) => activeCharIds.includes(character.id))
    .reduce((sum, character) => sum + (getSelectedAppearances(character)?.length || 0), 0)
}

export function ScriptViewCharactersSection({
  characters,
  activeCharIds,
  getSelectedAppearances,
  onOpenAssetLibrary,
  onUpdateClipAssets,
  showAddChar,
  setShowAddChar,
  mounted,
  charEditorTriggerRef,
  charEditorPopoverRef,
  pendingAppearanceKeys,
  setPendingAppearanceKeys,
  pendingAppearanceLabels,
  setPendingAppearanceLabels,
  isAllClipsMode,
  isSavingCharacterSelection,
  hasCharacterSelectionChanges,
  handleConfirmCharacterSelection,
  onToggleEditor,
  tScript,
  tAssets,
  tCommon,
}: ScriptViewCharactersSectionProps) {
  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[var(--glass-text-secondary)] flex items-center gap-2">
          {tScript('asset.activeCharacters')} (
          {getSelectedAppearanceCount(characters, activeCharIds, getSelectedAppearances)})
        </h3>
        <button
          ref={charEditorTriggerRef}
          onClick={onToggleEditor}
          className="inline-flex h-8 w-8 items-center justify-center text-[var(--glass-text-secondary)] hover:text-[var(--glass-tone-info-fg)] transition-colors"
        >
          <AppIcon name="edit" className="h-4 w-4" />
        </button>
      </div>

      {showAddChar && mounted && createPortal(
        <div
          ref={charEditorPopoverRef}
          className="fixed right-4 bottom-4 z-[80] glass-surface-modal w-[min(24rem,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] p-3 animate-fadeIn flex flex-col shadow-2xl"
        >
          <div className="shrink-0 text-xs text-[var(--glass-text-tertiary)]">
            {tCommon('edit')} · {tScript('asset.activeCharacters')}
          </div>
          <div className="mt-3 flex-1 min-h-0 space-y-4 overflow-y-auto pr-1 app-scrollbar">
            {isAllClipsMode && (
              <div className="rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)]/40 p-2 text-[11px] text-[var(--glass-text-tertiary)]">
                当前为“全部片段”视图，文案要求仅在单片段视图可编辑
              </div>
            )}
            {characters.map((character) => {
              const appearances = [...(character.appearances || [])].sort(
                (left, right) => left.appearanceIndex - right.appearanceIndex,
              )

              return (
                <div key={character.id} className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--glass-text-primary)]">
                    {character.name}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {appearances.map((appearance) => {
                      const currentAppearanceName =
                        appearance.changeReason || tAssets('character.primary')
                      const appearanceKey = `${character.id}::${currentAppearanceName}`
                      const isSelected = pendingAppearanceKeys.has(appearanceKey)
                      const previewUrl = getAppearancePreviewUrl(appearance)

                      return (
                        <div
                          key={`${character.id}-${appearance.appearanceIndex}`}
                          className="space-y-1"
                        >
                          <button
                            onClick={() => {
                              setPendingAppearanceKeys((previous) => {
                                const next = new Set(previous)
                                if (isSelected) {
                                  next.delete(appearanceKey)
                                } else {
                                  next.add(appearanceKey)
                                }
                                return next
                              })
                              setPendingAppearanceLabels((previous) => {
                                const next = { ...previous }
                                if (isSelected) {
                                  delete next[appearanceKey]
                                } else if (!next[appearanceKey]) {
                                  next[appearanceKey] = currentAppearanceName
                                }
                                return next
                              })
                            }}
                            className={`relative w-full rounded-lg overflow-hidden border-2 ${
                              isSelected
                                ? 'border-[var(--glass-stroke-success)]'
                                : 'border-transparent hover:border-[var(--glass-stroke-focus)]'
                            }`}
                          >
                            <div className="aspect-square bg-[var(--glass-bg-muted)]">
                              {previewUrl ? (
                                <MediaImageWithLoading
                                  src={previewUrl}
                                  alt={`${character.name}-${currentAppearanceName}`}
                                  containerClassName="h-full w-full"
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            {isSelected && (
                              <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--glass-tone-success-fg)] text-white shadow-md">
                                <AppIcon name="checkMicro" className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                          {isSelected && (
                            <input
                              value={pendingAppearanceLabels[appearanceKey] || currentAppearanceName}
                              disabled={isAllClipsMode}
                              onChange={(event) => {
                                const value = event.target.value
                                setPendingAppearanceLabels((previous) => ({
                                  ...previous,
                                  [appearanceKey]: value,
                                }))
                              }}
                              className="w-full rounded border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-2 py-1 text-xs text-[var(--glass-text-secondary)] outline-none focus:border-[var(--glass-stroke-focus)] disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex shrink-0 items-center justify-end gap-2 border-t border-[var(--glass-stroke-base)] pt-3">
            <button
              onClick={() => setShowAddChar(false)}
              disabled={isSavingCharacterSelection}
              className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs text-[var(--glass-text-secondary)]"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={() => void handleConfirmCharacterSelection()}
              disabled={isSavingCharacterSelection || !hasCharacterSelectionChanges}
              className="glass-btn-base glass-btn-primary rounded-lg px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tCommon('confirm')}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {activeCharIds.length === 0 ? (
        <div className="text-center text-[var(--glass-text-tertiary)] text-sm py-4">
          {tScript('screenplay.noCharacter')}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 px-1 py-1">
          {characters
            .filter((character) => activeCharIds.includes(character.id))
            .flatMap((character) => {
              const selectedAppearances = getSelectedAppearances(character) || []
              if (selectedAppearances.length === 0) {
                return (
                  <div key={`${character.id}-missing`} className="min-w-0">
                    <SpotlightCharCard
                      char={character}
                      appearance={undefined}
                      isActive={true}
                      onClick={() => {}}
                      onOpenAssetLibrary={onOpenAssetLibrary}
                      onRemove={() =>
                        void onUpdateClipAssets(
                          'character',
                          'remove',
                          character.id,
                          tScript('asset.defaultAppearance'),
                        )}
                    />
                  </div>
                )
              }

              return selectedAppearances.map((appearance) => (
                <div key={`${character.id}-${appearance.id}`} className="min-w-0">
                  <SpotlightCharCard
                    char={character}
                    appearance={appearance}
                    isActive={true}
                    onClick={() => {}}
                    onOpenAssetLibrary={onOpenAssetLibrary}
                    onRemove={() =>
                      void onUpdateClipAssets(
                        'character',
                        'remove',
                        character.id,
                        appearance.changeReason || tScript('asset.defaultAppearance'),
                      )}
                  />
                </div>
              ))
            })}
        </div>
      )}
    </div>
  )
}
