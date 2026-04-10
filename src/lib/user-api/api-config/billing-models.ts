import { getProviderKey } from '@/lib/api-config'
import { ApiError } from '@/lib/api-errors'
import type { UnifiedModelType } from '@/lib/model-config-contract'
import {
  findBuiltinPricingCatalogEntry,
  type PricingApiType,
} from '@/lib/model-pricing/catalog'
import { OPTIONAL_PRICING_PROVIDER_KEYS } from './default-models'
import type { StoredModel } from './types'

const BILLABLE_MODEL_TYPE_TO_PRICING_API_TYPE: Readonly<Record<UnifiedModelType, PricingApiType | null>> = {
  llm: 'text',
  image: 'image',
  video: 'video',
  audio: 'voice',
  lipsync: 'lip-sync',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasBuiltinPricingForModel(apiType: PricingApiType, provider: string, modelId: string): boolean {
  return !!findBuiltinPricingCatalogEntry(apiType, provider, modelId)
}

function hasCustomPricingForType(model: StoredModel): boolean {
  if (!model.customPricing) return false
  if (model.type === 'llm') {
    return (
      typeof model.customPricing.llm?.inputPerMillion === 'number'
      && typeof model.customPricing.llm?.outputPerMillion === 'number'
    )
  }
  if (model.type === 'image') {
    const imagePricing = model.customPricing.image
    return (
      typeof imagePricing?.basePrice === 'number'
      || (isRecord(imagePricing?.optionPrices) && Object.keys(imagePricing.optionPrices).length > 0)
    )
  }
  if (model.type === 'video') {
    const videoPricing = model.customPricing.video
    return (
      typeof videoPricing?.basePrice === 'number'
      || (isRecord(videoPricing?.optionPrices) && Object.keys(videoPricing.optionPrices).length > 0)
    )
  }
  return false
}

export function validateBillableModelPricing(models: StoredModel[]) {
  for (let index = 0; index < models.length; index += 1) {
    const model = models[index]
    const apiType = BILLABLE_MODEL_TYPE_TO_PRICING_API_TYPE[model.type]
    if (!apiType) continue

    if (hasCustomPricingForType(model)) continue
    if (OPTIONAL_PRICING_PROVIDER_KEYS.has(getProviderKey(model.provider))) continue

    if (!hasBuiltinPricingForModel(apiType, model.provider, model.modelId)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_PRICING_NOT_CONFIGURED',
        field: `models[${index}].modelId`,
        modelKey: model.modelKey,
        apiType,
      })
    }
  }
}

function isModelPricedForBilling(model: StoredModel): boolean {
  const apiType = BILLABLE_MODEL_TYPE_TO_PRICING_API_TYPE[model.type]
  if (!apiType) return true
  if (hasCustomPricingForType(model)) return true
  if (OPTIONAL_PRICING_PROVIDER_KEYS.has(getProviderKey(model.provider))) return true
  return hasBuiltinPricingForModel(apiType, model.provider, model.modelId)
}

export function sanitizeModelsForBilling(models: StoredModel[]): StoredModel[] {
  return models.filter((model) => isModelPricedForBilling(model))
}

