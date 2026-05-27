import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasValidationError,
  WorkflowNodeTypeRegistration,
} from './canvas-types'
import { collectNodeIdsReachableFrom, collectNodeIdsThatCanReach } from './canvas-graph'

function collectNodeIdsByCategory(
  registrations: ReadonlyMap<string, WorkflowNodeTypeRegistration>,
  category: WorkflowNodeTypeRegistration['category'],
): string[] {
  return Array.from(registrations.entries())
    .filter(([, registration]) => registration.category === category)
    .map(([nodeId]) => nodeId)
}

export function validateWorkflowConnectivity(params: {
  definition: WorkflowCanvasDefinition
  registrations: ReadonlyMap<string, WorkflowNodeTypeRegistration>
  errors: WorkflowCanvasValidationError[]
}) {
  const triggerIds = collectNodeIdsByCategory(params.registrations, 'trigger')
  const outputIds = collectNodeIdsByCategory(params.registrations, 'output')
  if (triggerIds.length === 0 || outputIds.length === 0) return

  const reachableFromTrigger = collectNodeIdsReachableFrom(params.definition, triggerIds)
  const canReachOutput = collectNodeIdsThatCanReach(params.definition, outputIds)
  for (const nodeId of params.registrations.keys()) {
    if (!reachableFromTrigger.has(nodeId)) {
      params.errors.push({
        code: 'NODE_NOT_REACHABLE_FROM_SOURCE',
        message: `Workflow node is not reachable from a trigger: ${nodeId}`,
        nodeId,
      })
    }
    if (!canReachOutput.has(nodeId)) {
      params.errors.push({
        code: 'NODE_CANNOT_REACH_OUTPUT',
        message: `Workflow node cannot reach an output: ${nodeId}`,
        nodeId,
      })
    }
  }
}
