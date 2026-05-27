'use client'

import { AppIcon } from '@/components/ui/icons'
import type { WorkflowCanvasDefinition } from '@/lib/workflow-engine/canvas-types'
import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-engine/node-catalog'

type Props = {
  definition: WorkflowCanvasDefinition
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  t: (key: string) => string
}

type RunInputField = Readonly<{
  key: string
  label: string
  placeholder: string
}>

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function runInputFields(definition: WorkflowCanvasDefinition): RunInputField[] {
  return definition.nodes
    .filter((node) => node.type === WORKFLOW_NODE_TYPES.USER_INPUT)
    .map((node) => {
      const config = node.config && !Array.isArray(node.config) ? node.config : {}
      const key = readString(config, 'outputKey') || node.step?.key?.trim() || node.id
      return {
        key,
        label: node.title?.trim() || readString(config, 'prompt') || key,
        placeholder: readString(config, 'prompt') || key,
      }
    })
}

export function buildWorkflowExecutionInput(
  definition: WorkflowCanvasDefinition,
  values: Record<string, string>,
): Record<string, unknown> {
  return Object.fromEntries(
    runInputFields(definition).map((field) => [field.key, values[field.key] || '']),
  )
}

export function pruneWorkflowRunInputValues(
  definition: WorkflowCanvasDefinition,
  values: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    runInputFields(definition).map((field) => [field.key, values[field.key] || '']),
  )
}

export function hasWorkflowRunInputFields(definition: WorkflowCanvasDefinition): boolean {
  return runInputFields(definition).length > 0
}

export default function WorkflowRunInputPanel({ definition, values, onChange, t }: Props) {
  const fields = runInputFields(definition)
  if (fields.length === 0) return null

  return (
    <div className="glass-surface px-4 py-3">
      <div className="mb-3 flex items-center gap-2">
        <AppIcon name="fileText" className="h-4 w-4 text-[var(--glass-tone-info-fg)]" />
        <div>
          <div className="text-sm font-bold text-[var(--glass-text-primary)]">{t('runInput')}</div>
          <div className="text-xs font-semibold text-[var(--glass-text-tertiary)]">{t('runInputHint')}</div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="block space-y-1.5">
            <span className="glass-field-label">{field.label}</span>
            <textarea
              className="glass-input-base min-h-20 resize-none px-3 py-2 text-sm"
              value={values[field.key] || ''}
              placeholder={field.placeholder}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
            <span className="block truncate font-mono text-[11px] font-semibold text-[var(--glass-text-tertiary)]">
              {field.key}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
