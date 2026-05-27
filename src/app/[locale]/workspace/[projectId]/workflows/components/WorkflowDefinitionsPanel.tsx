'use client'

import { AppIcon } from '@/components/ui/icons'
import type { ProjectWorkflowDefinitionSummary } from '@/lib/query/hooks'

type Props = {
  definitions: ProjectWorkflowDefinitionSummary[]
  selectedWorkflowType: string
  onSelect: (workflowType: string) => void
  onNew: () => void
  t: (key: string, values?: Record<string, string | number>) => string
}

export default function WorkflowDefinitionsPanel({
  definitions,
  selectedWorkflowType,
  onSelect,
  onNew,
  t,
}: Props) {
  return (
    <aside className="glass-surface flex min-h-[220px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--glass-stroke-base)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--glass-text-primary)]">
          <AppIcon name="folderOpen" className="h-4 w-4 text-[var(--glass-tone-info-fg)]" />
          {t('definitions')}
        </h2>
        <button
          type="button"
          onClick={onNew}
          className="glass-btn-base glass-btn-soft rounded-lg px-2.5 py-1.5 text-xs"
        >
          <AppIcon name="plus" className="h-3.5 w-3.5" />
          {t('newDraft')}
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {definitions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--glass-stroke-base)] px-3 py-5 text-center text-xs font-medium text-[var(--glass-text-tertiary)]">
            {t('emptyDefinitions')}
          </div>
        ) : definitions.map((definition) => {
          const selected = selectedWorkflowType === definition.workflowType
          const statusText = definition.publishedVersion
            ? t('published', { version: definition.publishedVersion })
            : t('noPublished')
          return (
            <button
              key={definition.id}
              type="button"
              onClick={() => onSelect(definition.workflowType)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                selected
                  ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)]'
                  : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] hover:border-[var(--glass-stroke-strong)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-[var(--glass-text-primary)]">
                  {definition.title}
                </span>
                {selected ? <span className="glass-chip glass-chip-info py-0.5 text-[10px]">{t('selected')}</span> : null}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--glass-text-tertiary)]">
                <span className="truncate">{definition.workflowType}</span>
                <span className={definition.draftValidation.valid ? 'text-[var(--glass-tone-success-fg)]' : 'text-[var(--glass-tone-warning-fg)]'}>
                  {statusText}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
