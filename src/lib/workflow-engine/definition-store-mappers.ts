import { ApiError } from '@/lib/api-errors'
import { normalizeWorkflowCanvasDefinition } from './canvas-normalize'
import type { WorkflowCanvasValidationResult } from './canvas-types'
import type {
  WorkflowDefinitionDetail,
  WorkflowDefinitionRow,
  WorkflowDefinitionSummary,
  WorkflowDefinitionVersionDetail,
  WorkflowDefinitionVersionRow,
} from './definition-store-types'

export function normalizeStoredValidation(value: unknown): WorkflowCanvasValidationResult {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as { valid?: unknown; errors?: unknown }
    if (typeof record.valid === 'boolean' && Array.isArray(record.errors)) {
      return record as WorkflowCanvasValidationResult
    }
  }
  return { valid: false, errors: [] }
}

export function toWorkflowDefinitionSummary(row: WorkflowDefinitionRow): WorkflowDefinitionSummary {
  const { draftDefinition: _definition, draftValidation, ...rest } = row
  return {
    ...rest,
    draftValidation: normalizeStoredValidation(draftValidation),
  }
}

export function toWorkflowDefinitionDetail(row: WorkflowDefinitionRow): WorkflowDefinitionDetail {
  const definition = normalizeWorkflowCanvasDefinition(row.draftDefinition)
  if (!definition) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'WORKFLOW_DEFINITION_STORED_INVALID',
      message: 'stored workflow definition is invalid',
    })
  }
  return {
    ...toWorkflowDefinitionSummary(row),
    draftDefinition: definition,
  }
}

export function toWorkflowDefinitionVersionDetail(
  row: WorkflowDefinitionVersionRow,
): WorkflowDefinitionVersionDetail {
  const definition = normalizeWorkflowCanvasDefinition(row.definition)
  if (!definition) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'WORKFLOW_DEFINITION_VERSION_STORED_INVALID',
      message: 'stored workflow definition version is invalid',
    })
  }
  const { definition: _definition, validation, ...rest } = row
  return {
    ...rest,
    definition,
    validation: normalizeStoredValidation(validation),
  }
}
