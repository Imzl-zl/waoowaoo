'use client'

import { AppIcon } from '@/components/ui/icons'
import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasValidationResult,
} from '@/lib/workflow-engine/canvas-types'

type Props = {
  definition: WorkflowCanvasDefinition
  validation: WorkflowCanvasValidationResult
  statusMessage: string | null
  savePending: boolean
  publishPending: boolean
  executePending: boolean
  canExecute: boolean
  onSave: () => void
  onPublish: () => void
  onExecute: () => void
  t: (key: string) => string
}

export default function WorkflowActionBar({
  definition,
  validation,
  statusMessage,
  savePending,
  publishPending,
  executePending,
  canExecute,
  onSave,
  onPublish,
  onExecute,
  t,
}: Props) {
  const isBusy = savePending || publishPending || executePending
  return (
    <div className="glass-surface flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-[var(--glass-text-primary)]">{definition.title}</div>
        <div className="truncate text-xs font-semibold text-[var(--glass-text-tertiary)]">{definition.workflowType}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`glass-chip ${validation.valid ? 'glass-chip-success' : 'glass-chip-warning'}`}>
          {validation.valid ? t('publishReady') : t('publishBlocked')}
        </span>
        {statusMessage ? (
          <span className="text-xs font-semibold text-[var(--glass-text-tertiary)]">{statusMessage}</span>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={isBusy}
          className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-2 text-sm"
        >
          <AppIcon name={savePending ? 'loader' : 'cloudUpload'} className={`h-4 w-4 ${savePending ? 'animate-spin' : ''}`} />
          {savePending ? t('saving') : t('save')}
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={isBusy || !validation.valid}
          className="glass-btn-base glass-btn-primary rounded-lg px-3 py-2 text-sm"
        >
          <AppIcon name={publishPending ? 'loader' : 'badgeCheck'} className={`h-4 w-4 ${publishPending ? 'animate-spin' : ''}`} />
          {publishPending ? t('publishing') : t('publish')}
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={isBusy || !canExecute}
          className="glass-btn-base glass-btn-primary rounded-lg px-3 py-2 text-sm"
        >
          <AppIcon name={executePending ? 'loader' : 'playCircle'} className={`h-4 w-4 ${executePending ? 'animate-spin' : ''}`} />
          {executePending ? t('executing') : t('execute')}
        </button>
      </div>
    </div>
  )
}
