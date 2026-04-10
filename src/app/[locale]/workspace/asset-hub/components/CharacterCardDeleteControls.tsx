'use client'

interface CharacterCardDeleteControlsProps {
  showDeleteConfirm: boolean
  showDeleteMenu: boolean
  appearanceCount: number
  menuClassName: string
  onCloseDeleteConfirm: () => void
  onDelete: () => void
  onCloseDeleteMenu: () => void
  onDeleteAppearance: () => void
  onOpenDeleteConfirm: () => void
  t: (key: string) => string
  tAssets: (key: string) => string
}

export function CharacterCardDeleteControls({
  showDeleteConfirm,
  showDeleteMenu,
  appearanceCount,
  menuClassName,
  onCloseDeleteConfirm,
  onDelete,
  onCloseDeleteMenu,
  onDeleteAppearance,
  onOpenDeleteConfirm,
  t,
  tAssets,
}: CharacterCardDeleteControlsProps) {
  return (
    <>
      {showDeleteMenu && appearanceCount > 1 && (
        <>
          <div className="fixed inset-0 z-10" onClick={onCloseDeleteMenu} />
          <div className={menuClassName}>
            <button
              onClick={onDeleteAppearance}
              className="glass-btn-base glass-btn-soft w-full justify-start rounded-none px-3 py-1.5 text-left text-xs"
            >
              {tAssets('image.deleteThis')}
            </button>
            <button
              onClick={onOpenDeleteConfirm}
              className="glass-btn-base glass-btn-soft w-full justify-start rounded-none px-3 py-1.5 text-left text-xs text-[var(--glass-tone-danger-fg)]"
            >
              {tAssets('character.deleteWhole')}
            </button>
          </div>
        </>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50">
          <div className="glass-surface-modal p-4 m-4 max-w-sm">
            <p className="mb-4 text-sm text-[var(--glass-text-primary)]">
              {t('confirmDeleteCharacter')}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onCloseDeleteConfirm}
                className="glass-btn-base glass-btn-secondary px-3 py-1.5 rounded-lg text-sm"
              >
                {t('cancel')}
              </button>
              <button
                onClick={onDelete}
                className="glass-btn-base glass-btn-danger px-3 py-1.5 rounded-lg text-sm"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
