'use client'

import { AppIcon } from '@/components/ui/icons'
import type { WorkflowCanvasValidationResult } from '@/lib/workflow-engine/canvas-types'

type Props = {
  validation: WorkflowCanvasValidationResult
  t: (key: string) => string
}

export default function WorkflowValidationPanel({ validation, t }: Props) {
  return (
    <section className="glass-surface flex min-h-[180px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--glass-stroke-base)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--glass-text-primary)]">
          <AppIcon name="clipboardCheck" className="h-4 w-4 text-[var(--glass-tone-info-fg)]" />
          {t('validation')}
        </h2>
        <span className={`glass-chip ${validation.valid ? 'glass-chip-success' : 'glass-chip-warning'}`}>
          {validation.valid ? t('valid') : String(validation.errors.length)}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {validation.valid ? (
          <div className="rounded-lg border border-[var(--glass-stroke-success)] bg-[var(--glass-tone-success-bg)] px-3 py-2 text-sm font-semibold text-[var(--glass-tone-success-fg)]">
            {t('noErrors')}
          </div>
        ) : validation.errors.map((error, index) => (
          <div
            key={`${error.code}.${error.nodeId || error.edgeId || index}`}
            className="rounded-lg border border-[var(--glass-stroke-warning)] bg-[var(--glass-tone-warning-bg)] px-3 py-2"
          >
            <div className="text-xs font-bold text-[var(--glass-tone-warning-fg)]">{error.code}</div>
            <div className="mt-1 text-sm font-medium text-[var(--glass-text-primary)]">{error.message}</div>
            {error.nodeId || error.edgeId ? (
              <div className="mt-1 text-[11px] font-semibold text-[var(--glass-text-tertiary)]">
                {error.nodeId || error.edgeId}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
