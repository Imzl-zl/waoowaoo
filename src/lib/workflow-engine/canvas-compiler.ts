import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasNode,
  WorkflowDefinition,
  WorkflowStepDefinition,
} from './canvas-types'
import { collectDirectSourceNodeIds, topologicalWorkflowNodeIds } from './canvas-graph'
import { validateWorkflowCanvasDefinition } from './canvas-validation'
import { getWorkflowNodeRegistration } from './node-catalog'

function collectIncomingStepKeys(definition: WorkflowCanvasDefinition, nodeId: string): string[] {
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]))
  const stepKeys = new Set<string>()
  const visited = new Set<string>()
  const collect = (sourceId: string) => {
    if (visited.has(sourceId)) return
    visited.add(sourceId)
    const source = nodes.get(sourceId)
    if (!source) return
    if (isStepNode(source)) {
      stepKeys.add(source.step?.key?.trim() || source.id)
      return
    }
    for (const parentId of collectDirectSourceNodeIds(definition, source.id)) collect(parentId)
  }
  for (const sourceId of collectDirectSourceNodeIds(definition, nodeId)) collect(sourceId)
  return Array.from(stepKeys)
}

function isStepNode(node: WorkflowCanvasNode): boolean {
  return Boolean(getWorkflowNodeRegistration(node.type)?.runtime.producesStep)
}

function buildStep(definition: WorkflowCanvasDefinition, nodeId: string): WorkflowStepDefinition | null {
  const node = definition.nodes.find((item) => item.id === nodeId)
  if (!node) return null
  const registration = getWorkflowNodeRegistration(node.type)
  if (!registration?.runtime.producesStep) return null
  return {
    key: node.step?.key?.trim() || node.id,
    dependsOn: collectIncomingStepKeys(definition, node.id),
    retryable: node.step?.retryable ?? registration.runtime.retryable,
    artifactTypes: [...(node.step?.artifactTypes || registration.runtime.artifactTypes)],
    failureMode: node.step?.failureMode || registration.runtime.failureMode,
  }
}

export function compileWorkflowCanvasDefinition(
  definition: WorkflowCanvasDefinition,
  resolveRetryInvalidationStepKeys: WorkflowDefinition['resolveRetryInvalidationStepKeys'],
): WorkflowDefinition {
  const validation = validateWorkflowCanvasDefinition(definition)
  if (!validation.valid) {
    throw new Error(`Invalid workflow canvas definition: ${validation.errors[0]?.code || 'UNKNOWN'}`)
  }
  const orderedSteps = topologicalWorkflowNodeIds(definition)
    .map((nodeId) => buildStep(definition, nodeId))
    .filter((step): step is WorkflowStepDefinition => Boolean(step))
  return {
    workflowType: definition.workflowType,
    orderedSteps,
    resolveRetryInvalidationStepKeys,
  }
}
