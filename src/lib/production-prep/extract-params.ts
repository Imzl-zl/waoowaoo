import { ApiError } from '@/lib/api-errors'
import { productionSourceModeSchema, type ProductionSourceMode } from '@/lib/production-bible'

export type NormalizedProductionPrepExtractParams = Readonly<{
  sourceText: string
  sourceMode: ProductionSourceMode
  title: string
  instruction: string
  language: string
}>

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readSourceMode(value: unknown): ProductionSourceMode {
  const parsed = productionSourceModeSchema.safeParse(value)
  return parsed.success ? parsed.data : 'manual'
}

export function normalizeProductionPrepExtractParams(input: unknown): NormalizedProductionPrepExtractParams {
  const record = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const sourceText = optionalString(record.sourceText || record.prompt)
  if (!sourceText) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PRODUCTION_PREP_SOURCE_REQUIRED',
      message: 'sourceText is required',
    })
  }
  return {
    sourceText,
    sourceMode: readSourceMode(record.sourceMode),
    title: optionalString(record.title),
    instruction: optionalString(record.instruction),
    language: optionalString(record.language) || 'zh-CN',
  }
}
