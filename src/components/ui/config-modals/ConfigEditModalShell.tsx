'use client'

import type { PropsWithChildren } from 'react'
import { AppIcon } from '@/components/ui/icons'

interface ConfigEditModalShellProps extends PropsWithChildren {
  onClose: () => void
  saveStatus: 'idle' | 'saved'
  t: (key: string) => string
}

export function ConfigEditModalShell({
  onClose,
  saveStatus,
  t,
  children,
}: ConfigEditModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center glass-overlay animate-fadeIn"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="glass-surface-modal p-7 w-full max-w-3xl transform transition-all scale-100 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-[var(--glass-text-primary)]">{t('title')}</h2>
          <div className="flex items-center gap-3">
            <div
              className={`glass-chip text-xs transition-all duration-300 ${
                saveStatus === 'saved' ? 'glass-chip-success' : 'glass-chip-neutral'
              }`}
            >
              {saveStatus === 'saved' ? (
                <>
                  <AppIcon name="check" className="w-3.5 h-3.5" />
                  {t('saved')}
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 bg-[var(--glass-tone-success-fg)] rounded-full" />
                  {t('autoSave')}
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="glass-btn-base glass-btn-soft rounded-full p-2 text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]"
            >
              <AppIcon name="close" className="w-6 h-6" />
            </button>
          </div>
        </div>
        <p className="text-[12px] text-[var(--glass-text-tertiary)] mb-6">{t('subtitle')}</p>
        <div className="space-y-5 flex-1 min-h-0 overflow-y-auto app-scrollbar">{children}</div>
      </div>
    </div>
  )
}
