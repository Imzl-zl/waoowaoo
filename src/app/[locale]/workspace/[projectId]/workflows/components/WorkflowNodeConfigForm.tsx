'use client'

import type {
  WorkflowCanvasNode,
  WorkflowNodeConfigFieldDefinition,
  WorkflowNodeConfigSchema,
  WorkflowNodeConfigValue,
} from '@/lib/workflow-engine/canvas-types'

type Props = {
  node: WorkflowCanvasNode
  schema: WorkflowNodeConfigSchema
  onConfigChange: (nodeId: string, configKey: string, value: WorkflowNodeConfigValue | undefined) => void
  t: (key: string) => string
}

function nodeConfig(node: WorkflowCanvasNode): Record<string, unknown> {
  if (!node.config || Array.isArray(node.config)) return {}
  return node.config
}

function stringInputValue(field: WorkflowNodeConfigFieldDefinition, config: Record<string, unknown>): string {
  const value = config[field.key]
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function placeholder(field: WorkflowNodeConfigFieldDefinition): string | undefined {
  if (field.placeholder) return field.placeholder
  if (field.defaultValue === undefined || field.defaultValue === '') return undefined
  return String(field.defaultValue)
}

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return Number(trimmed)
}

function FieldHelp({ field }: { field: WorkflowNodeConfigFieldDefinition }) {
  if (!field.helpText) return null
  return <p className="text-xs font-medium text-[var(--glass-text-tertiary)]">{field.helpText}</p>
}

export default function WorkflowNodeConfigForm({ node, schema, onConfigChange, t }: Props) {
  const config = nodeConfig(node)

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase text-[var(--glass-text-tertiary)]">{t('config')}</div>
      {schema.fields.map((field) => {
        const value = config[field.key]
        if (field.type === 'textarea') {
          return (
            <label key={field.key} className="block space-y-1.5">
              <span className="glass-field-label">{field.label}</span>
              <textarea
                className="glass-input-base min-h-24 resize-none px-3 py-2 text-sm"
                value={stringInputValue(field, config)}
                placeholder={placeholder(field)}
                onChange={(event) => onConfigChange(node.id, field.key, event.target.value)}
              />
              <FieldHelp field={field} />
            </label>
          )
        }

        if (field.type === 'number') {
          return (
            <label key={field.key} className="block space-y-1.5">
              <span className="glass-field-label">{field.label}</span>
              <input
                className="glass-input-base px-3 py-2 text-sm"
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={typeof value === 'number' ? String(value) : ''}
                placeholder={placeholder(field)}
                onChange={(event) => onConfigChange(node.id, field.key, parseNumberInput(event.target.value))}
              />
              <FieldHelp field={field} />
            </label>
          )
        }

        if (field.type === 'boolean') {
          return (
            <label
              key={field.key}
              className="flex items-center justify-between gap-3 rounded-lg bg-[var(--glass-bg-muted)] px-3 py-2"
            >
              <span className="text-sm font-semibold text-[var(--glass-text-primary)]">{field.label}</span>
              <input
                type="checkbox"
                checked={typeof value === 'boolean' ? value : false}
                onChange={(event) => onConfigChange(node.id, field.key, event.target.checked)}
              />
            </label>
          )
        }

        if (field.type === 'select') {
          return (
            <label key={field.key} className="block space-y-1.5">
              <span className="glass-field-label">{field.label}</span>
              <select
                className="glass-input-base px-3 py-2 text-sm"
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => onConfigChange(node.id, field.key, event.target.value || undefined)}
              >
                <option value="" disabled={field.required}>{t('selectConfigOption')}</option>
                {(field.options || []).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldHelp field={field} />
            </label>
          )
        }

        return (
          <label key={field.key} className="block space-y-1.5">
            <span className="glass-field-label">{field.label}</span>
            <input
              className="glass-input-base px-3 py-2 text-sm"
              value={stringInputValue(field, config)}
              placeholder={placeholder(field)}
              onChange={(event) => onConfigChange(node.id, field.key, event.target.value)}
            />
            <FieldHelp field={field} />
          </label>
        )
      })}
    </div>
  )
}
