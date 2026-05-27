import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowCanvasNodeStep,
  WorkflowCanvasPosition,
  WorkflowFailureMode,
} from './canvas-types'

const INVALID = Symbol('invalid-workflow-canvas-field')
type InvalidField = typeof INVALID

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function readFailureMode(value: unknown): WorkflowFailureMode | undefined {
  return value === 'fail_run' ? value : undefined
}

function normalizePosition(value: unknown): WorkflowCanvasPosition | undefined | InvalidField {
  if (value === undefined) return undefined
  const record = readRecord(value)
  if (!record) return INVALID
  const { x, y } = record
  if (typeof x !== 'number' || typeof y !== 'number') return INVALID
  if (!Number.isFinite(x) || !Number.isFinite(y)) return INVALID
  return { x, y }
}

function normalizeArtifactTypes(value: unknown): readonly string[] | undefined | InvalidField {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return INVALID
  const artifactTypes = value
    .map((item) => readText(item))
    .filter((item): item is string => Boolean(item))
  if (artifactTypes.length !== value.length) return INVALID
  return Array.from(new Set(artifactTypes))
}

function normalizeStep(value: unknown): WorkflowCanvasNodeStep | null | undefined | InvalidField {
  if (value === undefined) return undefined
  if (value === null) return null
  const record = readRecord(value)
  if (!record || 'dependsOn' in record) return INVALID
  const artifactTypes = normalizeArtifactTypes(record.artifactTypes)
  if (artifactTypes === INVALID) return INVALID
  const failureMode = readFailureMode(record.failureMode)
  if (record.failureMode !== undefined && !failureMode) return INVALID
  const key = readText(record.key)
  if (record.key !== undefined && !key) return INVALID
  return {
    ...(key ? { key } : {}),
    ...(typeof record.retryable === 'boolean' ? { retryable: record.retryable } : {}),
    ...(artifactTypes ? { artifactTypes } : {}),
    ...(failureMode ? { failureMode } : {}),
  }
}

function normalizeConfig(value: unknown): Record<string, unknown> | null | undefined | InvalidField {
  if (value === undefined) return undefined
  if (value === null) return null
  const record = readRecord(value)
  return record || INVALID
}

function normalizeNode(value: unknown): WorkflowCanvasNode | null {
  const record = readRecord(value)
  if (!record) return null
  const id = readText(record.id)
  const type = readText(record.type)
  if (!id || !type) return null
  const title = readText(record.title)
  if (record.title !== undefined && !title) return null
  const position = normalizePosition(record.position)
  if (position === INVALID) return null
  const config = normalizeConfig(record.config)
  if (config === INVALID) return null
  const step = normalizeStep(record.step)
  if (step === INVALID) return null
  return {
    id,
    type,
    ...(title ? { title } : {}),
    ...(position ? { position } : {}),
    ...(config !== undefined ? { config } : {}),
    ...(step !== undefined ? { step } : {}),
  }
}

function normalizeEdge(value: unknown): WorkflowCanvasEdge | null {
  const record = readRecord(value)
  if (!record) return null
  const id = readText(record.id)
  const sourceNodeId = readText(record.sourceNodeId)
  const sourcePort = readText(record.sourcePort)
  const targetNodeId = readText(record.targetNodeId)
  const targetPort = readText(record.targetPort)
  if (!id || !sourceNodeId || !sourcePort || !targetNodeId || !targetPort) return null
  return { id, sourceNodeId, sourcePort, targetNodeId, targetPort }
}

export function normalizeWorkflowCanvasDefinition(value: unknown): WorkflowCanvasDefinition | null {
  const record = readRecord(value)
  if (!record) return null
  const workflowType = readText(record.workflowType)
  const title = readText(record.title)
  if (record.schemaVersion !== 1 || !workflowType || !title) return null
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) return null
  const nodes = record.nodes.map((node) => normalizeNode(node))
  const edges = record.edges.map((edge) => normalizeEdge(edge))
  if (nodes.some((node) => !node) || edges.some((edge) => !edge)) return null
  return {
    schemaVersion: 1,
    workflowType,
    title,
    nodes: nodes as WorkflowCanvasNode[],
    edges: edges as WorkflowCanvasEdge[],
  }
}
