'use client'

import { AppIcon } from '@/components/ui/icons'
import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasNode,
  WorkflowNodeConfigValue,
} from '@/lib/workflow-engine/canvas-types'
import { getWorkflowNodeRegistration } from '@/lib/workflow-engine/node-catalog'
import WorkflowNodeConfigForm from './WorkflowNodeConfigForm'

type Props = {
  definition: WorkflowCanvasDefinition
  selectedNode: WorkflowCanvasNode | null
  onMetadataChange: (patch: Pick<WorkflowCanvasDefinition, 'workflowType' | 'title'>) => void
  onNodeChange: (nodeId: string, patch: Partial<Pick<WorkflowCanvasNode, 'title' | 'step' | 'config'>>) => void
  onNodeConfigChange: (nodeId: string, configKey: string, value: WorkflowNodeConfigValue | undefined) => void
  onDeleteNode: (nodeId: string) => void
  t: (key: string) => string
}

function parseArtifacts(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export default function WorkflowInspector({
  definition,
  selectedNode,
  onMetadataChange,
  onNodeChange,
  onNodeConfigChange,
  onDeleteNode,
  t,
}: Props) {
  const registration = selectedNode ? getWorkflowNodeRegistration(selectedNode.type) : null
  const isBoundary = registration?.category === 'trigger' || registration?.category === 'output'
  const step = selectedNode?.step || null

  return (
    <section className="glass-surface flex min-h-[360px] flex-col overflow-hidden">
      <div className="border-b border-[var(--glass-stroke-base)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--glass-text-primary)]">
          <AppIcon name="settingsHex" className="h-4 w-4 text-[var(--glass-tone-info-fg)]" />
          {t('inspector')}
        </h2>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <label className="block space-y-1.5">
          <span className="glass-field-label">{t('title')}</span>
          <input
            className="glass-input-base px-3 py-2 text-sm"
            value={definition.title}
            onChange={(event) => onMetadataChange({
              title: event.target.value,
              workflowType: definition.workflowType,
            })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="glass-field-label">{t('workflowType')}</span>
          <input
            className="glass-input-base px-3 py-2 font-mono text-sm"
            value={definition.workflowType}
            onChange={(event) => onMetadataChange({
              title: definition.title,
              workflowType: event.target.value,
            })}
          />
        </label>
        <div className="glass-divider" />
        {selectedNode ? (
          <>
            <div>
              <div className="text-xs font-bold uppercase text-[var(--glass-text-tertiary)]">{selectedNode.type}</div>
              <div className="mt-1 text-sm font-semibold text-[var(--glass-text-primary)]">{selectedNode.id}</div>
            </div>
            <label className="block space-y-1.5">
              <span className="glass-field-label">{t('nodeTitle')}</span>
              <input
                className="glass-input-base px-3 py-2 text-sm"
                value={selectedNode.title || ''}
                onChange={(event) => onNodeChange(selectedNode.id, { title: event.target.value })}
              />
            </label>
            {registration?.configSchema ? (
              <>
                <div className="glass-divider" />
                <WorkflowNodeConfigForm
                  node={selectedNode}
                  schema={registration.configSchema}
                  onConfigChange={onNodeConfigChange}
                  t={t}
                />
              </>
            ) : null}
            {step ? (
              <>
                <label className="block space-y-1.5">
                  <span className="glass-field-label">{t('stepKey')}</span>
                  <input
                    className="glass-input-base px-3 py-2 font-mono text-sm"
                    value={step.key || ''}
                    onChange={(event) => onNodeChange(selectedNode.id, {
                      step: { ...step, key: event.target.value || undefined },
                    })}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="glass-field-label">{t('artifacts')}</span>
                  <input
                    className="glass-input-base px-3 py-2 font-mono text-sm"
                    value={(step.artifactTypes || []).join(', ')}
                    onChange={(event) => onNodeChange(selectedNode.id, {
                      step: { ...step, artifactTypes: parseArtifacts(event.target.value) },
                    })}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg bg-[var(--glass-bg-muted)] px-3 py-2">
                  <span className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('retryable')}</span>
                  <input
                    type="checkbox"
                    checked={step.retryable !== false}
                    onChange={(event) => onNodeChange(selectedNode.id, {
                      step: { ...step, retryable: event.target.checked },
                    })}
                  />
                </label>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => onDeleteNode(selectedNode.id)}
              disabled={isBoundary}
              className="glass-btn-base glass-btn-tone-danger w-full rounded-lg px-3 py-2 text-sm"
            >
              <AppIcon name="trash" className="h-4 w-4" />
              {isBoundary ? t('fixedNode') : t('deleteNode')}
            </button>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--glass-stroke-base)] px-3 py-6 text-center text-sm font-medium text-[var(--glass-text-tertiary)]">
            {t('selectNode')}
          </div>
        )}
      </div>
    </section>
  )
}
