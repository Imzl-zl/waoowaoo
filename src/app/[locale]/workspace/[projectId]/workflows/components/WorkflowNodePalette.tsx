'use client'

import { AppIcon } from '@/components/ui/icons'
import type { WorkflowNodeTypeRegistration } from '@/lib/workflow-engine/canvas-types'

type Props = {
  registrations: WorkflowNodeTypeRegistration[]
  onAddNode: (nodeType: string) => void
  t: (key: string) => string
}

const CATEGORY_ICON: Record<WorkflowNodeTypeRegistration['category'], Parameters<typeof AppIcon>[0]['name']> = {
  trigger: 'playCircle',
  input: 'fileText',
  ai: 'brain',
  production: 'clapperboard',
  logic: 'cpu',
  media: 'film',
  data: 'folderOpen',
  output: 'badgeCheck',
}

export default function WorkflowNodePalette({ registrations, onAddNode, t }: Props) {
  return (
    <section className="glass-surface flex min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--glass-stroke-base)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--glass-text-primary)]">
          <AppIcon name="package" className="h-4 w-4 text-[var(--glass-tone-info-fg)]" />
          {t('nodes')}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-1">
        {registrations.map((registration) => {
          const canAdd = registration.category !== 'trigger' && registration.category !== 'output'
          return (
            <button
              key={registration.type}
              type="button"
              onClick={() => onAddNode(registration.type)}
              disabled={!canAdd}
              className="glass-btn-base glass-btn-soft min-h-16 w-full justify-start rounded-lg px-3 py-2 text-left disabled:opacity-45"
              title={canAdd ? registration.type : t('fixedNode')}
            >
              <span className="glass-surface-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <AppIcon name={CATEGORY_ICON[registration.category]} className="h-4 w-4 text-[var(--glass-text-secondary)]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[var(--glass-text-primary)]">
                  {registration.label}
                </span>
                <span className="block truncate text-[11px] font-medium text-[var(--glass-text-tertiary)]">
                  {registration.runtime.producesStep ? t('stepNode') : t('passthroughNode')}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
