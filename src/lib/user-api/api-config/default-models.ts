import { getProviderKey } from '@/lib/api-config'
import { ApiError } from '@/lib/api-errors'
import {
  composeModelKey,
  parseModelKeyStrict,
} from '@/lib/model-config-contract'
import { findBuiltinPricingCatalogEntry } from '@/lib/model-pricing/catalog'
import {
  DEFAULT_ANALYSIS_WORKFLOW_CONCURRENCY,
  DEFAULT_IMAGE_WORKFLOW_CONCURRENCY,
  DEFAULT_VIDEO_WORKFLOW_CONCURRENCY,
  normalizeWorkflowConcurrencyValue,
} from '@/lib/workflow-concurrency'
import type {
  DefaultModelField,
  DefaultModelPricingApiType,
  DefaultModelsPayload,
  WorkflowConcurrencyPayload,
} from './types'

export const DEFAULT_MODEL_FIELDS: DefaultModelField[] = [
  'analysisModel',
  'characterModel',
  'locationModel',
  'storyboardModel',
  'editModel',
  'videoModel',
  'audioModel',
  'lipSyncModel',
  'voiceDesignModel',
]

export const DEFAULT_FIELD_TO_PRICING_API_TYPE: Readonly<Record<DefaultModelField, DefaultModelPricingApiType>> = {
  analysisModel: 'text',
  characterModel: 'image',
  locationModel: 'image',
  storyboardModel: 'image',
  editModel: 'image',
  videoModel: 'video',
  audioModel: 'voice',
  lipSyncModel: 'lip-sync',
  voiceDesignModel: 'voice',
}

export const OPTIONAL_PRICING_PROVIDER_KEYS = new Set([
  'openai-compatible',
  'gemini-compatible',
  'bailian',
  'siliconflow',
])

export const DEFAULT_LIPSYNC_MODEL_KEY = composeModelKey('fal', 'fal-ai/kling-video/lipsync/audio-to-video')

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasBuiltinPricingForModel(apiType: DefaultModelPricingApiType, provider: string, modelId: string): boolean {
  return !!findBuiltinPricingCatalogEntry(apiType, provider, modelId)
}

function validateDefaultModelKey(field: DefaultModelField, value: unknown): string | null {
  if (value === undefined) return null
  const modelKey = readTrimmedString(value)
  if (!modelKey) return null
  const parsed = parseModelKeyStrict(modelKey)
  if (!parsed) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_KEY_INVALID',
      field: `defaultModels.${field}`,
    })
  }
  return parsed.modelKey
}

export function normalizeDefaultModelsInput(rawDefaultModels: unknown): DefaultModelsPayload {
  if (rawDefaultModels === undefined) return {}
  if (!isRecord(rawDefaultModels)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'DEFAULT_MODELS_INVALID',
      field: 'defaultModels',
    })
  }

  const normalized: DefaultModelsPayload = {}
  for (const field of DEFAULT_MODEL_FIELDS) {
    const rawValue = rawDefaultModels[field]
    if (rawValue !== undefined) {
      normalized[field] = validateDefaultModelKey(field, rawValue) || ''
    }
  }

  return normalized
}

export function normalizeWorkflowConcurrencyInput(rawWorkflowConcurrency: unknown): WorkflowConcurrencyPayload {
  if (rawWorkflowConcurrency === undefined) return {}
  if (!isRecord(rawWorkflowConcurrency)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'INVALID_PARAMS',
      field: 'workflowConcurrency',
    })
  }

  const normalized: WorkflowConcurrencyPayload = {}

  const analysisValue = rawWorkflowConcurrency.analysis
  if (analysisValue !== undefined) {
    const value = normalizeWorkflowConcurrencyValue(
      analysisValue,
      DEFAULT_ANALYSIS_WORKFLOW_CONCURRENCY,
    )
    if (value !== analysisValue) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'INVALID_PARAMS',
        field: 'workflowConcurrency.analysis',
      })
    }
    normalized.analysis = value
  }

  const imageValue = rawWorkflowConcurrency.image
  if (imageValue !== undefined) {
    const value = normalizeWorkflowConcurrencyValue(
      imageValue,
      DEFAULT_IMAGE_WORKFLOW_CONCURRENCY,
    )
    if (value !== imageValue) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'INVALID_PARAMS',
        field: 'workflowConcurrency.image',
      })
    }
    normalized.image = value
  }

  const videoValue = rawWorkflowConcurrency.video
  if (videoValue !== undefined) {
    const value = normalizeWorkflowConcurrencyValue(
      videoValue,
      DEFAULT_VIDEO_WORKFLOW_CONCURRENCY,
    )
    if (value !== videoValue) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'INVALID_PARAMS',
        field: 'workflowConcurrency.video',
      })
    }
    normalized.video = value
  }

  return normalized
}

export function validateDefaultModelPricing(defaultModels: DefaultModelsPayload) {
  for (const field of DEFAULT_MODEL_FIELDS) {
    const modelKey = defaultModels[field]
    if (!modelKey) continue

    const parsed = parseModelKeyStrict(modelKey)
    if (!parsed) continue
    if (OPTIONAL_PRICING_PROVIDER_KEYS.has(getProviderKey(parsed.provider))) continue
    const apiType = DEFAULT_FIELD_TO_PRICING_API_TYPE[field]

    if (!hasBuiltinPricingForModel(apiType, parsed.provider, parsed.modelId)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'DEFAULT_MODEL_PRICING_NOT_CONFIGURED',
        field: `defaultModels.${field}`,
        modelKey: parsed.modelKey,
        apiType,
      })
    }
  }
}

export function sanitizeDefaultModelsForBilling(defaultModels: DefaultModelsPayload): DefaultModelsPayload {
  const sanitized: DefaultModelsPayload = {}

  for (const field of DEFAULT_MODEL_FIELDS) {
    const rawModelKey = defaultModels[field]
    if (rawModelKey === undefined) continue
    const modelKey = readTrimmedString(rawModelKey)
    if (!modelKey) {
      sanitized[field] = ''
      continue
    }

    const parsed = parseModelKeyStrict(modelKey)
    if (!parsed) {
      sanitized[field] = ''
      continue
    }
    if (OPTIONAL_PRICING_PROVIDER_KEYS.has(getProviderKey(parsed.provider))) {
      sanitized[field] = parsed.modelKey
      continue
    }

    const apiType = DEFAULT_FIELD_TO_PRICING_API_TYPE[field]
    sanitized[field] = hasBuiltinPricingForModel(apiType, parsed.provider, parsed.modelId)
      ? parsed.modelKey
      : ''
  }

  return sanitized
}
