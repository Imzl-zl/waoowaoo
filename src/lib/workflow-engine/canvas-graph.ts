import type { WorkflowCanvasDefinition } from './canvas-types'

function buildOutgoingNodeMap(definition: WorkflowCanvasDefinition): Map<string, string[]> {
  const outgoing = new Map<string, string[]>()
  for (const node of definition.nodes) outgoing.set(node.id, [])
  for (const edge of definition.edges) {
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId)
  }
  return outgoing
}

function buildIncomingNodeMap(definition: WorkflowCanvasDefinition): Map<string, string[]> {
  const incoming = new Map<string, string[]>()
  for (const node of definition.nodes) incoming.set(node.id, [])
  for (const edge of definition.edges) {
    incoming.get(edge.targetNodeId)?.push(edge.sourceNodeId)
  }
  return incoming
}

function collectReachableNodeIds(startNodeIds: readonly string[], graph: ReadonlyMap<string, string[]>): Set<string> {
  const reachable = new Set<string>()
  const queue = [...startNodeIds]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || reachable.has(current)) continue
    reachable.add(current)
    for (const next of graph.get(current) || []) queue.push(next)
  }
  return reachable
}

export function collectNodeIdsReachableFrom(
  definition: WorkflowCanvasDefinition,
  startNodeIds: readonly string[],
): Set<string> {
  return collectReachableNodeIds(startNodeIds, buildOutgoingNodeMap(definition))
}

export function collectNodeIdsThatCanReach(
  definition: WorkflowCanvasDefinition,
  targetNodeIds: readonly string[],
): Set<string> {
  return collectReachableNodeIds(targetNodeIds, buildIncomingNodeMap(definition))
}

export function collectDirectSourceNodeIds(definition: WorkflowCanvasDefinition, targetNodeId: string): string[] {
  return buildIncomingNodeMap(definition).get(targetNodeId) || []
}

export function hasWorkflowCycle(definition: WorkflowCanvasDefinition): boolean {
  const outgoing = buildOutgoingNodeMap(definition)

  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visiting.add(nodeId)
    for (const nextId of outgoing.get(nodeId) || []) {
      if (visit(nextId)) return true
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }
  return definition.nodes.some((node) => visit(node.id))
}

export function topologicalWorkflowNodeIds(definition: WorkflowCanvasDefinition): string[] {
  const nodeOrder = new Map(definition.nodes.map((node, index) => [node.id, index]))
  const incomingCount = new Map(definition.nodes.map((node) => [node.id, 0]))
  const outgoing = new Map(definition.nodes.map((node) => [node.id, [] as string[]]))

  for (const edge of definition.edges) {
    incomingCount.set(edge.targetNodeId, (incomingCount.get(edge.targetNodeId) || 0) + 1)
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId)
  }

  const ready = definition.nodes
    .filter((node) => incomingCount.get(node.id) === 0)
    .map((node) => node.id)
  const ordered: string[] = []

  while (ready.length > 0) {
    ready.sort((left, right) => (nodeOrder.get(left) || 0) - (nodeOrder.get(right) || 0))
    const current = ready.shift()
    if (!current) continue
    ordered.push(current)
    for (const target of outgoing.get(current) || []) {
      const nextCount = (incomingCount.get(target) || 0) - 1
      incomingCount.set(target, nextCount)
      if (nextCount === 0) ready.push(target)
    }
  }

  return ordered
}
