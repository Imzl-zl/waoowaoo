'use client'

import { createPortal } from 'react-dom'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Location } from '@/types/project'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import { AppIcon } from '@/components/ui/icons'
import { SpotlightLocationCard, getSelectedLocationImage } from './SpotlightCards'
import type { ScriptViewTranslator, UpdateClipAssets } from './scriptViewAssetPanelTypes'

interface ScriptViewLocationsSectionProps {
  locations: Location[]
  activeLocationIds: string[]
  onOpenAssetLibrary?: () => void
  onUpdateClipAssets: UpdateClipAssets
  showAddLoc: boolean
  setShowAddLoc: Dispatch<SetStateAction<boolean>>
  mounted: boolean
  locEditorTriggerRef: RefObject<HTMLButtonElement | null>
  locEditorPopoverRef: RefObject<HTMLDivElement | null>
  pendingLocationIds: Set<string>
  setPendingLocationIds: Dispatch<SetStateAction<Set<string>>>
  pendingLocationLabels: Record<string, string>
  setPendingLocationLabels: Dispatch<SetStateAction<Record<string, string>>>
  isAllClipsMode: boolean
  isSavingLocationSelection: boolean
  hasLocationSelectionChanges: boolean
  handleConfirmLocationSelection: () => Promise<void>
  onToggleEditor: () => void
  tScript: ScriptViewTranslator
  tCommon: ScriptViewTranslator
}

export function ScriptViewLocationsSection({
  locations,
  activeLocationIds,
  onOpenAssetLibrary,
  onUpdateClipAssets,
  showAddLoc,
  setShowAddLoc,
  mounted,
  locEditorTriggerRef,
  locEditorPopoverRef,
  pendingLocationIds,
  setPendingLocationIds,
  pendingLocationLabels,
  setPendingLocationLabels,
  isAllClipsMode,
  isSavingLocationSelection,
  hasLocationSelectionChanges,
  handleConfirmLocationSelection,
  onToggleEditor,
  tScript,
  tCommon,
}: ScriptViewLocationsSectionProps) {
  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[var(--glass-text-secondary)]">
          {tScript('asset.activeLocations')} ({activeLocationIds.length})
        </h3>
        <button
          ref={locEditorTriggerRef}
          onClick={onToggleEditor}
          className="inline-flex h-8 w-8 items-center justify-center text-[var(--glass-text-secondary)] hover:text-[var(--glass-tone-info-fg)] transition-colors"
        >
          <AppIcon name="edit" className="h-4 w-4" />
        </button>
      </div>

      {showAddLoc && mounted && createPortal(
        <div
          ref={locEditorPopoverRef}
          className="fixed right-4 bottom-4 z-[80] glass-surface-modal w-[min(24rem,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] p-3 animate-fadeIn flex flex-col shadow-2xl"
        >
          <div className="shrink-0 text-xs text-[var(--glass-text-tertiary)]">
            {tCommon('edit')} · {tScript('asset.activeLocations')}
          </div>
          <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 app-scrollbar">
            {isAllClipsMode && (
              <div className="mb-3 rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)]/40 p-2 text-[11px] text-[var(--glass-text-tertiary)]">
                当前为“全部片段”视图，场景文案要求仅在单片段视图可编辑
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {locations.map((location) => {
                const isSelected = pendingLocationIds.has(location.id)
                const previewImage = getSelectedLocationImage(location)?.imageUrl || null

                return (
                  <div key={location.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setPendingLocationIds((previous) => {
                          const next = new Set(previous)
                          if (isSelected) {
                            next.delete(location.id)
                          } else {
                            next.add(location.id)
                          }
                          return next
                        })
                        setPendingLocationLabels((previous) => {
                          const next = { ...previous }
                          if (isSelected) {
                            delete next[location.id]
                          } else if (!next[location.id]) {
                            next[location.id] = location.name
                          }
                          return next
                        })
                      }}
                      className={`relative w-full overflow-hidden rounded-lg border-2 text-left transition-colors ${
                        isSelected
                          ? 'border-[var(--glass-stroke-success)]'
                          : 'border-transparent hover:border-[var(--glass-stroke-focus)]'
                      }`}
                    >
                      <div className="aspect-video bg-[var(--glass-bg-muted)]">
                        {previewImage ? (
                          <MediaImageWithLoading
                            src={previewImage}
                            alt={location.name}
                            containerClassName="h-full w-full"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="truncate px-2 py-1 text-xs font-medium text-[var(--glass-text-secondary)]">
                        {location.name}
                      </div>
                      {isSelected && (
                        <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--glass-tone-success-fg)] text-white shadow-md">
                          <AppIcon name="checkMicro" className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                    {isSelected && (
                      <input
                        value={pendingLocationLabels[location.id] || location.name}
                        disabled={isAllClipsMode}
                        onChange={(event) => {
                          const value = event.target.value
                          setPendingLocationLabels((previous) => ({
                            ...previous,
                            [location.id]: value,
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
          <div className="mt-3 flex shrink-0 items-center justify-end gap-2 border-t border-[var(--glass-stroke-base)] pt-3">
            <button
              onClick={() => setShowAddLoc(false)}
              disabled={isSavingLocationSelection}
              className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs text-[var(--glass-text-secondary)]"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={() => void handleConfirmLocationSelection()}
              disabled={isSavingLocationSelection || !hasLocationSelectionChanges}
              className="glass-btn-base glass-btn-primary rounded-lg px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tCommon('confirm')}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {activeLocationIds.length === 0 ? (
        <div className="text-center text-[var(--glass-text-tertiary)] text-sm py-4">
          {tScript('screenplay.noLocation')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-1 py-1">
          {locations
            .filter((location) => activeLocationIds.includes(location.id))
            .map((location) => (
              <div key={location.id} className="min-w-0">
                <SpotlightLocationCard
                  location={location}
                  isActive={true}
                  onClick={() => {}}
                  onOpenAssetLibrary={onOpenAssetLibrary}
                  onRemove={() => void onUpdateClipAssets('location', 'remove', location.id)}
                />
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
