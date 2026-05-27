import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasValidationError,
  WorkflowNodeTypeRegistration,
} from './canvas-types'

function addError(errors: WorkflowCanvasValidationError[], error: WorkflowCanvasValidationError) {
  errors.push(error)
}

export function validateWorkflowBoundaryNodes(params: {
  definition: WorkflowCanvasDefinition
  registrations: ReadonlyMap<string, WorkflowNodeTypeRegistration>
  errors: WorkflowCanvasValidationError[]
}) {
  const incoming = new Set(params.definition.edges.map((edge) => edge.targetNodeId))
  const outgoing = new Set(params.definition.edges.map((edge) => edge.sourceNodeId))
  const categories = Array.from(params.registrations.entries())
  const triggers = categories.filter(([, registration]) => registration.category === 'trigger')
  const outputs = categories.filter(([, registration]) => registration.category === 'output')
  if (triggers.length === 0) {
    addError(params.errors, { code: 'MISSING_TRIGGER', message: 'Workflow requires a trigger node' })
  }
  if (outputs.length === 0) {
    addError(params.errors, { code: 'MISSING_OUTPUT', message: 'Workflow requires an output node' })
  }
  for (const [nodeId] of triggers) {
    if (!incoming.has(nodeId)) continue
    addError(params.errors, {
      code: 'TRIGGER_HAS_INCOMING_EDGE',
      message: 'Trigger nodes cannot have incoming edges',
      nodeId,
    })
  }
  for (const [nodeId] of outputs) {
    if (!outgoing.has(nodeId)) continue
    addError(params.errors, {
      code: 'OUTPUT_HAS_OUTGOING_EDGE',
      message: 'Output nodes cannot have outgoing edges',
      nodeId,
    })
  }
}
