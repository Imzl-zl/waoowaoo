'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  usePublishedWorkflowRunStream,
  useProjectWorkflowDefinition,
  useProjectWorkflowDefinitions,
  usePublishProjectWorkflowDefinition,
  useSaveProjectWorkflowDefinitionDraft,
} from '@/lib/query/hooks'
import type { WorkflowCanvasDefinition, WorkflowCanvasNode } from '@/lib/workflow-engine/canvas-types'
import {
  addWorkflowCanvasNode,
  createDefaultWorkflowCanvasDefinition,
  listWorkflowCanvasNodeRegistrations,
  removeWorkflowCanvasNode,
  updateWorkflowCanvasMetadata,
  updateWorkflowCanvasNode,
  updateWorkflowCanvasNodeConfig,
} from '@/lib/workflow-engine/canvas-editor'
import { validateWorkflowCanvasDefinition } from '@/lib/workflow-engine/canvas-validation'
import WorkflowActionBar from './WorkflowActionBar'
import WorkflowCanvasPreview from './WorkflowCanvasPreview'
import WorkflowDefinitionsPanel from './WorkflowDefinitionsPanel'
import WorkflowInspector from './WorkflowInspector'
import WorkflowNodePalette from './WorkflowNodePalette'
import WorkflowRunInputPanel, {
  buildWorkflowExecutionInput,
  pruneWorkflowRunInputValues,
} from './WorkflowRunInputPanel'
import WorkflowRunStatePanel from './WorkflowRunStatePanel'
import WorkflowValidationPanel from './WorkflowValidationPanel'

type Props = { projectId: string }

function uniqueDraftWorkflowType(definitions: readonly { workflowType: string }[]): string {
  const existing = new Set(definitions.map((definition) => definition.workflowType))
  const base = 'custom.workflow'
  let counter = 1
  let candidate = base
  while (existing.has(candidate)) {
    counter += 1
    candidate = `${base}.${counter}`
  }
  return candidate
}

function createLocalDraft(definitions: readonly { workflowType: string }[]): WorkflowCanvasDefinition {
  const definition = createDefaultWorkflowCanvasDefinition()
  return {
    ...definition,
    workflowType: uniqueDraftWorkflowType(definitions),
  }
}

export default function WorkflowBuilderShell({ projectId }: Props) {
  const t = useTranslations('workflowBuilder')
  const definitionsQuery = useProjectWorkflowDefinitions(projectId)
  const saveDraft = useSaveProjectWorkflowDefinitionDraft(projectId)
  const publishDefinition = usePublishProjectWorkflowDefinition(projectId)
  const workflowRun = usePublishedWorkflowRunStream(projectId)
  const definitions = definitionsQuery.data || []
  const [definition, setDefinition] = useState<WorkflowCanvasDefinition>(() => createLocalDraft([]))
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<string>('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('trigger')
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const selectedSummary = definitions.find((item) => item.workflowType === selectedWorkflowType) || null
  const detailQuery = useProjectWorkflowDefinition(
    projectId,
    selectedSummary?.workflowType || null,
    Boolean(selectedSummary),
  )
  const validation = useMemo(() => validateWorkflowCanvasDefinition(definition), [definition])
  const selectedNode = definition.nodes.find((node) => node.id === selectedNodeId) || null
  const registrations = useMemo(() => listWorkflowCanvasNodeRegistrations(), [])
  const canExecute = Boolean(selectedSummary?.publishedVersionId || detailQuery.data?.publishedVersionId)

  useEffect(() => {
    if (selectedWorkflowType || definitionsQuery.isLoading) return
    const firstDefinition = definitions[0]
    if (firstDefinition) {
      setSelectedWorkflowType(firstDefinition.workflowType)
      return
    }
    const draft = createLocalDraft(definitions)
    setDefinition(draft)
    setSelectedWorkflowType(draft.workflowType)
    setSelectedNodeId(draft.nodes[0]?.id || null)
  }, [definitions, definitionsQuery.isLoading, selectedWorkflowType])

  useEffect(() => {
    const remoteDefinition = detailQuery.data?.draftDefinition
    if (!remoteDefinition) return
    setDefinition(remoteDefinition)
    setSelectedNodeId(remoteDefinition.nodes[0]?.id || null)
    setStatusMessage(null)
  }, [detailQuery.data?.draftDefinition])

  useEffect(() => {
    setRunInputValues((current) => pruneWorkflowRunInputValues(definition, current))
  }, [definition])

  function handleNewDraft() {
    const draft = createLocalDraft(definitions)
    setDefinition(draft)
    setSelectedWorkflowType(draft.workflowType)
    setSelectedNodeId(draft.nodes[0]?.id || null)
    setStatusMessage(t('localDraft'))
  }

  function handleDefinitionChange(nextDefinition: WorkflowCanvasDefinition) {
    setDefinition(nextDefinition)
    setSelectedWorkflowType(nextDefinition.workflowType)
    if (selectedNodeId && !nextDefinition.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(nextDefinition.nodes[0]?.id || null)
    }
    setStatusMessage(null)
  }

  async function handleSave() {
    try {
      const saved = await saveDraft.mutateAsync(definition)
      setDefinition(saved.draftDefinition)
      setSelectedWorkflowType(saved.workflowType)
      setStatusMessage(t('saved'))
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('saveFailed'))
    }
  }

  async function handlePublish() {
    try {
      const saved = await saveDraft.mutateAsync(definition)
      const result = await publishDefinition.mutateAsync(saved.workflowType)
      setDefinition(result.definition.draftDefinition)
      setSelectedWorkflowType(result.definition.workflowType)
      setStatusMessage(t('published', { version: result.version.version }))
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('publishFailed'))
    }
  }

  async function handleExecute() {
    try {
      const result = await workflowRun.run({
        workflowType: definition.workflowType,
        executionInput: buildWorkflowExecutionInput(definition, runInputValues),
      })
      if (result.status === 'failed') {
        setStatusMessage(result.errorMessage || t('runFailed', { runId: result.runId || '-' }))
        return
      }
      setStatusMessage(t('runCompleted', { runId: result.runId }))
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('executeFailed'))
    }
  }

  function handleMetadataChange(patch: Pick<WorkflowCanvasDefinition, 'workflowType' | 'title'>) {
    handleDefinitionChange(updateWorkflowCanvasMetadata(definition, patch))
  }

  function handleNodeChange(nodeId: string, patch: Partial<Pick<WorkflowCanvasNode, 'title' | 'step' | 'config'>>) {
    handleDefinitionChange(updateWorkflowCanvasNode(definition, nodeId, patch))
  }

  function handleNodeConfigChange(nodeId: string, configKey: string, value: string | number | boolean | undefined) {
    handleDefinitionChange(updateWorkflowCanvasNodeConfig(definition, nodeId, configKey, value))
  }

  function handleAddNode(nodeType: string) {
    const nextDefinition = addWorkflowCanvasNode(definition, nodeType)
    handleDefinitionChange(nextDefinition)
    setSelectedNodeId(nextDefinition.nodes.at(-2)?.id || nextDefinition.nodes.at(-1)?.id || null)
  }

  function handleDeleteNode(nodeId: string) {
    handleDefinitionChange(removeWorkflowCanvasNode(definition, nodeId))
  }

  function handleRunInputChange(key: string, value: string) {
    setRunInputValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
      <div className="flex min-h-0 flex-col gap-4">
        <WorkflowDefinitionsPanel
          definitions={definitions}
          selectedWorkflowType={selectedWorkflowType}
          onSelect={setSelectedWorkflowType}
          onNew={handleNewDraft}
          t={t}
        />
        <WorkflowNodePalette registrations={registrations} onAddNode={handleAddNode} t={t} />
      </div>
      <div className="min-w-0 space-y-4">
        <WorkflowActionBar
          definition={definition}
          validation={validation}
          statusMessage={statusMessage}
          savePending={saveDraft.isPending}
          publishPending={publishDefinition.isPending}
          executePending={workflowRun.isRunning}
          canExecute={canExecute}
          onSave={() => void handleSave()}
          onPublish={() => void handlePublish()}
          onExecute={() => void handleExecute()}
          t={t}
        />
        {definitionsQuery.error || detailQuery.error ? (
          <div className="glass-surface border-[var(--glass-stroke-danger)] px-4 py-3 text-sm font-semibold text-[var(--glass-tone-danger-fg)]">
            {t('loadFailed')}
          </div>
        ) : null}
        <WorkflowRunInputPanel
          definition={definition}
          values={runInputValues}
          onChange={handleRunInputChange}
          t={t}
        />
        <WorkflowRunStatePanel
          runId={workflowRun.runId}
          status={workflowRun.status}
          activeMessage={workflowRun.activeMessage}
          overallProgress={workflowRun.overallProgress}
          orderedSteps={workflowRun.orderedSteps}
          outputText={workflowRun.outputText}
          errorMessage={workflowRun.errorMessage}
          onSelectStep={workflowRun.selectStep}
          t={t}
        />
        <WorkflowCanvasPreview
          definition={definition}
          selectedNodeId={selectedNodeId}
          onDefinitionChange={handleDefinitionChange}
          onSelectNode={setSelectedNodeId}
          t={t}
        />
      </div>
      <div className="flex min-h-0 flex-col gap-4">
        <WorkflowInspector
          definition={definition}
          selectedNode={selectedNode}
          onMetadataChange={handleMetadataChange}
          onNodeChange={handleNodeChange}
          onNodeConfigChange={handleNodeConfigChange}
          onDeleteNode={handleDeleteNode}
          t={t}
        />
        <WorkflowValidationPanel validation={validation} t={t} />
      </div>
    </div>
  )
}
