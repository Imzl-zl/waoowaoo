import { ApiError } from '@/lib/api-errors'
import { normalizeWorkflowCanvasDefinition } from './canvas-normalize'
import type { WorkflowCanvasDefinition } from './canvas-types'
import { validateWorkflowCanvasDefinition } from './canvas-validation'
import type { WorkflowDefinitionRow } from './definition-store-types'

export function normalizeDraftDefinition(value: unknown): WorkflowCanvasDefinition {
  const definition = normalizeWorkflowCanvasDefinition(value)
  if (!definition) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'WORKFLOW_DEFINITION_INVALID_SHAPE',
      message: 'workflow definition payload is invalid',
    })
  }
  return definition
}

export function ensureWorkflowType(expected: string | undefined, definition: WorkflowCanvasDefinition) {
  if (!expected || expected === definition.workflowType) return
  throw new ApiError('INVALID_PARAMS', {
    code: 'WORKFLOW_TYPE_MISMATCH',
    message: 'workflowType does not match route parameter',
  })
}

export function ensurePublishable(row: WorkflowDefinitionRow): WorkflowCanvasDefinition {
  const definition = normalizeDraftDefinition(row.draftDefinition)
  const validation = validateWorkflowCanvasDefinition(definition)
  if (validation.valid) return definition
  throw new ApiError('INVALID_PARAMS', {
    code: 'WORKFLOW_DEFINITION_VALIDATION_FAILED',
    message: 'workflow definition draft is not publishable',
    validation,
  })
}
