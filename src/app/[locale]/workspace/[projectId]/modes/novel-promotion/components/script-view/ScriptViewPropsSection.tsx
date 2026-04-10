'use client'

import { createPortal } from 'react-dom'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Location, Prop } from '@/types/project'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import { AppIcon } from '@/components/ui/icons'
import { SpotlightLocationCard, getSelectedLocationImage } from './SpotlightCards'

interface ScriptViewPropsSectionProps {
  props: Prop[]
  activePropIds: string[]
  onOpenAssetLibrary?: () => void
  onUpdateClipAssets: (
    type: 'character' | 'location' | 'prop',
    action: 'add' | 'remove',
    id: string,
    optionLabel?: string,
  ) => Promise<void>
  onToggleEditor: () => void
  showAddProp: boolean
  setShowAddProp: Dispatch<SetStateAction<boolean>>
  mounted: boolean
  propEditorTriggerRef: RefObject<HTMLButtonElement | null>
  propEditorPopoverRef: RefObject<HTMLDivElement | null>
  pendingPropIds: Set<string>
  setPendingPropIds: Dispatch<SetStateAction<Set<string>>>
  isSavingPropSelection: boolean
  hasPropSelectionChanges: boolean
  handleConfirmPropSelection: () => Promise<void>
  tCommon: (key: string, values?: Record<string, unknown>) => string
}

export function ScriptViewPropsSection({
  props,
  activePropIds,
  onOpenAssetLibrary,
  onUpdateClipAssets,
  onToggleEditor,
  showAddProp,
  setShowAddProp,
  mounted,
  propEditorTriggerRef,
  propEditorPopoverRef,
  pendingPropIds,
  setPendingPropIds,
  isSavingPropSelection,
  hasPropSelectionChanges,
  handleConfirmPropSelection,
  tCommon,
}: ScriptViewPropsSectionProps) {
  if (props.length === 0) return null

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[var(--glass-text-secondary)] flex items-center gap-2">
          道具 ({activePropIds.length})
        </h3>
        <button
          ref={propEditorTriggerRef}
          onClick={onToggleEditor}
          className="inline-flex h-8 w-8 items-center justify-center text-[var(--glass-text-secondary)] hover:text-[var(--glass-tone-info-fg)] transition-colors"
        >
          <AppIcon name="edit" className="h-4 w-4" />
        </button>
      </div>

      {showAddProp && mounted && createPortal(
        <div ref={propEditorPopoverRef} className="fixed right-4 bottom-4 z-[80] glass-surface-modal w-[min(24rem,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] p-3 animate-fadeIn flex flex-col shadow-2xl">
          <div className="shrink-0 text-xs text-[var(--glass-text-tertiary)]">{tCommon('edit')} · 道具</div>
          <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 app-scrollbar">
            <div className="grid grid-cols-2 gap-2">
              {props.map((prop) => {
                const isSelected = pendingPropIds.has(prop.id)
                const previewImage = getSelectedLocationImage(prop as unknown as Location)?.imageUrl || null
                return (
                  <button
                    key={prop.id}
                    onClick={() => {
                      setPendingPropIds((previous) => {
                        const next = new Set(previous)
                        if (isSelected) {
                          next.delete(prop.id)
                        } else {
                          next.add(prop.id)
                        }
                        return next
                      })
                    }}
                    className={`relative w-full overflow-hidden rounded-lg border-2 text-left transition-colors ${isSelected ? 'border-[var(--glass-stroke-success)]' : 'border-transparent hover:border-[var(--glass-stroke-focus)]'}`}
                  >
                    <div className="aspect-video bg-[var(--glass-bg-muted)]">
                      {previewImage ? (
                        <MediaImageWithLoading
                          src={previewImage}
                          alt={prop.name}
                          containerClassName="h-full w-full"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="truncate px-2 py-1 text-xs font-medium text-[var(--glass-text-secondary)]">
                      {prop.name}
                    </div>
                    {isSelected && (
                      <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--glass-tone-success-fg)] text-white shadow-md">
                        <AppIcon name="checkMicro" className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-3 flex shrink-0 items-center justify-end gap-2 border-t border-[var(--glass-stroke-base)] pt-3">
            <button
              onClick={() => setShowAddProp(false)}
              disabled={isSavingPropSelection}
              className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs text-[var(--glass-text-secondary)]"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={() => void handleConfirmPropSelection()}
              disabled={isSavingPropSelection || !hasPropSelectionChanges}
              className="glass-btn-base glass-btn-primary rounded-lg px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tCommon('confirm')}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {activePropIds.length === 0 ? (
        <div className="text-center text-[var(--glass-text-tertiary)] text-sm py-4">当前片段未选择道具</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-1 py-1">
          {props.filter((prop) => activePropIds.includes(prop.id)).map((prop) => (
            <div key={prop.id} className="min-w-0">
              <SpotlightLocationCard
                location={prop as unknown as Location}
                isActive={true}
                onClick={() => { }}
                onOpenAssetLibrary={onOpenAssetLibrary}
                onRemove={() => void onUpdateClipAssets('prop', 'remove', prop.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
