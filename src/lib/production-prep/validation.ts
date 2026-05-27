import { ApiError } from '@/lib/api-errors'
import {
  parseProductionPrepDocument,
  validateProductionPrepDocument,
  type ProductionPrepDocument,
  type ProductionPrepValidationIssue,
} from '@/lib/production-bible'

function throwValidationError(issues: readonly ProductionPrepValidationIssue[]): never {
  throw new ApiError('INVALID_PARAMS', {
    code: 'PRODUCTION_PREP_VALIDATION_FAILED',
    message: 'production prep document failed validation',
    issues,
  })
}

export function assertValidProductionPrepDocument(input: unknown): ProductionPrepDocument {
  const validation = validateProductionPrepDocument(input)
  if (!validation.valid || !validation.document) {
    throwValidationError(validation.issues)
  }
  return validation.document
}

export function parseGeneratedProductionPrepDocument(input: unknown): ProductionPrepDocument {
  try {
    return parseProductionPrepDocument(input)
  } catch (error) {
    throw new ApiError('GENERATION_FAILED', {
      code: 'PRODUCTION_PREP_GENERATED_SCHEMA_INVALID',
      message: error instanceof Error ? error.message : 'generated production prep schema is invalid',
    })
  }
}

export function assertGeneratedProductionPrepDocument(input: unknown): ProductionPrepDocument {
  const document = parseGeneratedProductionPrepDocument(input)
  const validation = validateProductionPrepDocument(document)
  if (!validation.valid) {
    throw new ApiError('GENERATION_FAILED', {
      code: 'PRODUCTION_PREP_GENERATED_VALIDATION_FAILED',
      message: 'generated production prep document failed validation',
      issues: validation.issues,
    })
  }
  return document
}
