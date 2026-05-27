import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowCanvasValidationError,
  WorkflowCanvasValidationResult,
  WorkflowNodeTypeRegistration,
} from './canvas-types'
import { validateWorkflowBoundaryNodes } from './canvas-boundary-validation'
import { validateWorkflowNodeConfigs } from './canvas-config-validation'
import { validateWorkflowConnectivity } from './canvas-connectivity-validation'
import { hasWorkflowCycle } from './canvas-graph'
import { getWorkflowNodeRegistration } from './node-catalog'

function addError(errors: WorkflowCanvasValidationError[], error: WorkflowCanvasValidationError) {
  errors.push(error)
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}

function findPort(registration: WorkflowNodeTypeRegistration, portKey: string) {
  return registration.ports.find((port) => port.key === portKey) || null
}

function collectDuplicateIds(items: readonly { id: string }[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id)
    seen.add(item.id)
  }
  return duplicates
}

function validateNodeTypes(
  nodes: readonly WorkflowCanvasNode[],
  errors: WorkflowCanvasValidationError[],
): Map<string, WorkflowNodeTypeRegistration> {
  const registrations = new Map<string, WorkflowNodeTypeRegistration>()
  for (const node of nodes) {
    const registration = getWorkflowNodeRegistration(node.type)
    if (!registration) {
      addError(errors, {
        code: 'UNKNOWN_NODE_TYPE',
        message: `Unknown workflow node type: ${node.type}`,
        nodeId: node.id,
        nodeType: node.type,
      })
      continue
    }
    registrations.set(node.id, registration)
  }
  return registrations
}

function validatePort(params: {
  edge: WorkflowCanvasEdge
  nodeId: string
  portKey: string
  expectedDirection: 'input' | 'output'
  registrations: ReadonlyMap<string, WorkflowNodeTypeRegistration>
  errors: WorkflowCanvasValidationError[]
}) {
  const registration = params.registrations.get(params.nodeId)
  if (!registration) return
  const port = findPort(registration, params.portKey)
  if (!port) {
    addError(params.errors, {
      code: 'UNKNOWN_PORT',
      message: `Unknown ${params.expectedDirection} port: ${params.portKey}`,
      nodeId: params.nodeId,
      edgeId: params.edge.id,
      portKey: params.portKey,
    })
    return
  }
  if (port.direction !== params.expectedDirection) {
    addError(params.errors, {
      code: 'INVALID_PORT_DIRECTION',
      message: `Port ${params.portKey} is not a ${params.expectedDirection} port`,
      nodeId: params.nodeId,
      edgeId: params.edge.id,
      portKey: params.portKey,
    })
  }
}

function validateEdges(params: {
  definition: WorkflowCanvasDefinition
  registrations: ReadonlyMap<string, WorkflowNodeTypeRegistration>
  errors: WorkflowCanvasValidationError[]
}) {
  const nodeIds = new Set(params.definition.nodes.map((node) => node.id))
  for (const edge of params.definition.edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      addError(params.errors, {
        code: 'UNKNOWN_EDGE_NODE',
        message: `Edge ${edge.id} references an unknown node`,
        edgeId: edge.id,
      })
      continue
    }
    validatePort({
      edge,
      nodeId: edge.sourceNodeId,
      portKey: edge.sourcePort,
      expectedDirection: 'output',
      registrations: params.registrations,
      errors: params.errors,
    })
    validatePort({
      edge,
      nodeId: edge.targetNodeId,
      portKey: edge.targetPort,
      expectedDirection: 'input',
      registrations: params.registrations,
      errors: params.errors,
    })
  }
}

function validateStepKeys(
  definition: WorkflowCanvasDefinition,
  registrations: ReadonlyMap<string, WorkflowNodeTypeRegistration>,
  errors: WorkflowCanvasValidationError[],
) {
  const seen = new Set<string>()
  for (const node of definition.nodes) {
    const registration = registrations.get(node.id)
    if (!registration?.runtime.producesStep) continue
    const stepKey = node.step?.key?.trim() || node.id
    if (seen.has(stepKey)) {
      addError(errors, {
        code: 'DUPLICATE_STEP_KEY',
        message: `Duplicate workflow step key: ${stepKey}`,
        nodeId: node.id,
      })
    }
    seen.add(stepKey)
  }
}

export function validateWorkflowCanvasDefinition(
  definition: WorkflowCanvasDefinition,
): WorkflowCanvasValidationResult {
  const errors: WorkflowCanvasValidationError[] = []
  if (!hasText(definition.workflowType)) {
    addError(errors, { code: 'WORKFLOW_TYPE_REQUIRED', message: 'workflowType is required' })
  }
  if (!hasText(definition.title)) {
    addError(errors, { code: 'TITLE_REQUIRED', message: 'title is required' })
  }
  for (const duplicateId of collectDuplicateIds(definition.nodes)) {
    addError(errors, { code: 'DUPLICATE_NODE_ID', message: `Duplicate node id: ${duplicateId}`, nodeId: duplicateId })
  }
  for (const duplicateId of collectDuplicateIds(definition.edges)) {
    addError(errors, { code: 'DUPLICATE_EDGE_ID', message: `Duplicate edge id: ${duplicateId}`, edgeId: duplicateId })
  }
  const registrations = validateNodeTypes(definition.nodes, errors)
  validateWorkflowNodeConfigs({ definition, registrations, errors })
  validateEdges({ definition, registrations, errors })
  validateWorkflowBoundaryNodes({ definition, registrations, errors })
  validateStepKeys(definition, registrations, errors)
  validateWorkflowConnectivity({ definition, registrations, errors })
  if (hasWorkflowCycle(definition)) {
    addError(errors, { code: 'WORKFLOW_HAS_CYCLE', message: 'Workflow graph cannot contain cycles' })
  }
  return { valid: errors.length === 0, errors }
}
