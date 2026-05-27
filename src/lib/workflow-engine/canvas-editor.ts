import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowCanvasNodeStep,
  WorkflowNodeConfigValue,
  WorkflowNodePortDefinition,
  WorkflowNodeTypeRegistration,
} from './canvas-types'
import { createDefaultWorkflowNodeConfig } from './node-config'
import {
  getWorkflowNodeRegistration,
  workflowNodeCatalog,
  WORKFLOW_NODE_TYPES,
} from './node-catalog'

export const DEFAULT_WORKFLOW_TYPE = 'custom.workflow'
export const DEFAULT_WORKFLOW_TITLE = 'Custom workflow'

export type WorkflowCanvasNodePatch = Partial<Pick<WorkflowCanvasNode, 'title' | 'step' | 'config'>>

const BOUNDARY_CATEGORIES = new Set<WorkflowNodeTypeRegistration['category']>(['trigger', 'output'])

function firstPort(
  registration: WorkflowNodeTypeRegistration | null,
  direction: WorkflowNodePortDefinition['direction'],
): WorkflowNodePortDefinition | null {
  return registration?.ports.find((port) => port.direction === direction) || null
}

function isBoundaryNode(node: WorkflowCanvasNode): boolean {
  const registration = getWorkflowNodeRegistration(node.type)
  return Boolean(registration && BOUNDARY_CATEGORIES.has(registration.category))
}

function workflowCanvasEdgeId(
  edge: Pick<WorkflowCanvasEdge, 'sourceNodeId' | 'sourcePort' | 'targetNodeId' | 'targetPort'>,
): string {
  return `edge.${edge.sourceNodeId}.${edge.sourcePort}.${edge.targetNodeId}.${edge.targetPort}`
}

function edgeBetween(source: WorkflowCanvasNode, target: WorkflowCanvasNode): WorkflowCanvasEdge | null {
  const sourcePort = firstPort(getWorkflowNodeRegistration(source.type), 'output')
  const targetPort = firstPort(getWorkflowNodeRegistration(target.type), 'input')
  if (!sourcePort || !targetPort) return null
  return {
    id: workflowCanvasEdgeId({
      sourceNodeId: source.id,
      sourcePort: sourcePort.key,
      targetNodeId: target.id,
      targetPort: targetPort.key,
    }),
    sourceNodeId: source.id,
    sourcePort: sourcePort.key,
    targetNodeId: target.id,
    targetPort: targetPort.key,
  }
}

function sequentialEdges(nodes: readonly WorkflowCanvasNode[]): WorkflowCanvasEdge[] {
  const edges: WorkflowCanvasEdge[] = []
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const edge = edgeBetween(nodes[index], nodes[index + 1])
    if (edge) edges.push(edge)
  }
  return edges
}

function withSequentialNodes(definition: WorkflowCanvasDefinition, nodes: WorkflowCanvasNode[]): WorkflowCanvasDefinition {
  return {
    ...definition,
    nodes,
    edges: sequentialEdges(nodes),
  }
}

function appendEdge(
  edges: readonly WorkflowCanvasEdge[],
  source: WorkflowCanvasNode,
  target: WorkflowCanvasNode,
): WorkflowCanvasEdge[] {
  const edge = edgeBetween(source, target)
  if (!edge || edges.some((item) => item.id === edge.id)) return [...edges]
  return [...edges, edge]
}

function insertNodeBeforeOutput(
  definition: WorkflowCanvasDefinition,
  nodes: WorkflowCanvasNode[],
  node: WorkflowCanvasNode,
): WorkflowCanvasDefinition {
  const output = nodes.find((item) => getWorkflowNodeRegistration(item.type)?.category === 'output') || null
  if (!output) return { ...definition, nodes }
  const incoming = definition.edges.find((edge) => edge.targetNodeId === output.id) || null
  const withoutOutputIncoming = definition.edges.filter((edge) => edge.id !== incoming?.id)
  const source = incoming ? nodes.find((item) => item.id === incoming.sourceNodeId) || null : null
  const withSourceEdge = source ? appendEdge(withoutOutputIncoming, source, node) : withoutOutputIncoming
  return {
    ...definition,
    nodes,
    edges: appendEdge(withSourceEdge, node, output),
  }
}

function nodeStep(registration: WorkflowNodeTypeRegistration): WorkflowCanvasNodeStep | undefined {
  if (!registration.runtime.producesStep) return undefined
  return {
    retryable: registration.runtime.retryable,
    artifactTypes: [...registration.runtime.artifactTypes],
    failureMode: registration.runtime.failureMode,
  }
}

function uniqueNodeId(type: string, nodes: readonly WorkflowCanvasNode[]): string {
  const existing = new Set(nodes.map((node) => node.id))
  const base = type.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'node'
  let counter = 1
  let candidate = base
  while (existing.has(candidate)) {
    counter += 1
    candidate = `${base}_${counter}`
  }
  return candidate
}

export function listWorkflowCanvasNodeRegistrations(): WorkflowNodeTypeRegistration[] {
  return Array.from(workflowNodeCatalog.values())
}

export function createDefaultWorkflowCanvasDefinition(): WorkflowCanvasDefinition {
  const nodes: WorkflowCanvasNode[] = [
    {
      id: 'trigger',
      type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER,
      title: 'Manual trigger',
      position: { x: 0, y: 120 },
    },
    {
      id: 'output',
      type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT,
      title: 'Output',
      position: { x: 360, y: 120 },
    },
  ]
  return {
    schemaVersion: 1,
    workflowType: DEFAULT_WORKFLOW_TYPE,
    title: DEFAULT_WORKFLOW_TITLE,
    nodes,
    edges: sequentialEdges(nodes),
  }
}

export function addWorkflowCanvasNode(
  definition: WorkflowCanvasDefinition,
  nodeType: string,
): WorkflowCanvasDefinition {
  const registration = getWorkflowNodeRegistration(nodeType)
  if (!registration) throw new Error(`Unknown workflow node type: ${nodeType}`)
  const config = createDefaultWorkflowNodeConfig(registration)
  const node: WorkflowCanvasNode = {
    id: uniqueNodeId(nodeType, definition.nodes),
    type: nodeType,
    title: registration.label,
    position: { x: 180 * definition.nodes.length, y: 120 },
    ...(config ? { config } : {}),
    step: nodeStep(registration),
  }
  const outputNodes = definition.nodes.filter((item) => {
    return getWorkflowNodeRegistration(item.type)?.category === 'output'
  })
  const precedingNodes = definition.nodes.filter((item) => {
    return getWorkflowNodeRegistration(item.type)?.category !== 'output'
  })
  return insertNodeBeforeOutput(definition, [...precedingNodes, node, ...outputNodes], node)
}

export function removeWorkflowCanvasNode(
  definition: WorkflowCanvasDefinition,
  nodeId: string,
): WorkflowCanvasDefinition {
  const target = definition.nodes.find((node) => node.id === nodeId)
  if (!target || isBoundaryNode(target)) return definition
  const incoming = definition.edges.filter((edge) => edge.targetNodeId === nodeId)
  const outgoing = definition.edges.filter((edge) => edge.sourceNodeId === nodeId)
  const nodes = definition.nodes.filter((node) => node.id !== nodeId)
  const edges = definition.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
  if (incoming.length !== 1 || outgoing.length !== 1) return { ...definition, nodes, edges }
  const source = nodes.find((node) => node.id === incoming[0].sourceNodeId) || null
  const targetNode = nodes.find((node) => node.id === outgoing[0].targetNodeId) || null
  if (!source || !targetNode) return { ...definition, nodes, edges }
  return {
    ...definition,
    nodes,
    edges: appendEdge(edges, source, targetNode),
  }
}

export function moveWorkflowCanvasNode(
  definition: WorkflowCanvasDefinition,
  nodeId: string,
  direction: -1 | 1,
): WorkflowCanvasDefinition {
  const boundaryNodes = definition.nodes.filter(isBoundaryNode)
  const workflowNodes = definition.nodes.filter((node) => !isBoundaryNode(node))
  const index = workflowNodes.findIndex((node) => node.id === nodeId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= workflowNodes.length) return definition
  const reordered = [...workflowNodes]
  const [node] = reordered.splice(index, 1)
  reordered.splice(nextIndex, 0, node)
  const triggers = boundaryNodes.filter((node) => getWorkflowNodeRegistration(node.type)?.category === 'trigger')
  const outputs = boundaryNodes.filter((node) => getWorkflowNodeRegistration(node.type)?.category === 'output')
  return withSequentialNodes(definition, [...triggers, ...reordered, ...outputs])
}

export function updateWorkflowCanvasMetadata(
  definition: WorkflowCanvasDefinition,
  patch: Pick<WorkflowCanvasDefinition, 'workflowType' | 'title'>,
): WorkflowCanvasDefinition {
  return {
    ...definition,
    workflowType: patch.workflowType,
    title: patch.title,
  }
}

export function updateWorkflowCanvasNode(
  definition: WorkflowCanvasDefinition,
  nodeId: string,
  patch: WorkflowCanvasNodePatch,
): WorkflowCanvasDefinition {
  return {
    ...definition,
    nodes: definition.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node),
  }
}

export function updateWorkflowCanvasNodeConfig(
  definition: WorkflowCanvasDefinition,
  nodeId: string,
  configKey: string,
  value: WorkflowNodeConfigValue | undefined,
): WorkflowCanvasDefinition {
  return {
    ...definition,
    nodes: definition.nodes.map((node) => {
      if (node.id !== nodeId) return node
      const config = { ...(node.config || {}) }
      if (value === undefined) {
        delete config[configKey]
      } else {
        config[configKey] = value
      }
      return {
        ...node,
        config: Object.keys(config).length > 0 ? config : undefined,
      }
    }),
  }
}

export function updateWorkflowCanvasNodePosition(
  definition: WorkflowCanvasDefinition,
  nodeId: string,
  position: WorkflowCanvasNode['position'],
): WorkflowCanvasDefinition {
  return {
    ...definition,
    nodes: definition.nodes.map((node) => node.id === nodeId ? { ...node, position } : node),
  }
}

export function connectWorkflowCanvasNodes(
  definition: WorkflowCanvasDefinition,
  connection: Pick<WorkflowCanvasEdge, 'sourceNodeId' | 'targetNodeId'> &
    Partial<Pick<WorkflowCanvasEdge, 'sourcePort' | 'targetPort'>>,
): WorkflowCanvasDefinition {
  const source = definition.nodes.find((node) => node.id === connection.sourceNodeId)
  const target = definition.nodes.find((node) => node.id === connection.targetNodeId)
  if (!source || !target) return definition
  const sourcePort = connection.sourcePort || firstPort(getWorkflowNodeRegistration(source.type), 'output')?.key
  const targetPort = connection.targetPort || firstPort(getWorkflowNodeRegistration(target.type), 'input')?.key
  if (!sourcePort || !targetPort) return definition
  const edge: WorkflowCanvasEdge = {
    id: workflowCanvasEdgeId({
      sourceNodeId: source.id,
      sourcePort,
      targetNodeId: target.id,
      targetPort,
    }),
    sourceNodeId: source.id,
    sourcePort,
    targetNodeId: target.id,
    targetPort,
  }
  if (definition.edges.some((item) => item.id === edge.id)) return definition
  return {
    ...definition,
    edges: [...definition.edges, edge],
  }
}

export function removeWorkflowCanvasEdge(
  definition: WorkflowCanvasDefinition,
  edgeId: string,
): WorkflowCanvasDefinition {
  return {
    ...definition,
    edges: definition.edges.filter((edge) => edge.id !== edgeId),
  }
}
