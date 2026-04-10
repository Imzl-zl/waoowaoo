import { ApiError } from '@/lib/api-errors'
import {
  getCapabilityOptionFields,
  resolveBuiltinModelContext,
} from '@/lib/model-capabilities/lookup'
import { getBillingMode } from '@/lib/billing/mode'
import { normalizeWorkflowConcurrencyConfig } from '@/lib/workflow-concurrency'
import { buildGeminiCompatibleDisabledPresets } from './gemini-compatible-presets'
import {
  sanitizeModelsForBilling,
  validateBillableModelPricing,
} from './billing-models'
import {
  normalizeCapabilitySelectionsInput,
  parseStoredCapabilitySelections,
  sanitizeCapabilitySelectionsAgainstModels,
  serializeCapabilitySelections,
  validateCapabilitySelectionsAgainstModels,
} from './capability-selections'
import {
  DEFAULT_LIPSYNC_MODEL_KEY,
  normalizeDefaultModelsInput,
  normalizeWorkflowConcurrencyInput,
  sanitizeDefaultModelsForBilling,
  validateDefaultModelPricing,
} from './default-models'
import {
  buildPricingDisplayMap,
  withDisplayPricing,
} from './pricing-display'
import {
  resolveStoredLlmProtocols,
  resolveStoredMediaTemplates,
} from './openai-compat-models'
import {
  normalizeModelList,
  normalizeProvidersInput,
  parseStoredModels,
  parseStoredProviders,
  validateModelProviderConsistency,
  validateModelProviderTypeSupport,
} from './model-normalization'
import type {
  ApiConfigPutBody,
  StoredModel,
} from './types'
import { validateOpenAICompatMediaTemplate } from '@/lib/user-api/model-template/validator'
import {
  applyDefaultModelUpdates,
  applyWorkflowConcurrencyUpdates,
  buildRawDefaultModels,
  decryptStoredProviders,
  readUserApiConfigExistingPreference,
  readUserApiConfigPreference,
  readWorkflowConcurrencyFromPreference,
  serializeProvidersForStorage,
  upsertUserApiConfigPreference,
} from './persistence'

function validateCustomPricingCapabilityMappings(models: StoredModel[]) {
  for (let index = 0; index < models.length; index += 1) {
    const model = models[index]
    if (model.type !== 'image' && model.type !== 'video') continue

    const mediaPricing = model.type === 'image'
      ? model.customPricing?.image
      : model.customPricing?.video
    const optionPrices = mediaPricing?.optionPrices
    if (!optionPrices || Object.keys(optionPrices).length === 0) continue

    const context = resolveBuiltinModelContext(model.type, model.modelKey)
    if (!context) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'CAPABILITY_MODEL_UNSUPPORTED',
        field: `models[${index}].customPricing.${model.type}.optionPrices`,
      })
    }

    const optionFields = getCapabilityOptionFields(model.type, context.capabilities)
    for (const [field, optionMap] of Object.entries(optionPrices)) {
      const allowedValues = optionFields[field]
      if (!allowedValues) {
        throw new ApiError('INVALID_PARAMS', {
          code: 'CAPABILITY_FIELD_INVALID',
          field: `models[${index}].customPricing.${model.type}.optionPrices.${field}`,
        })
      }
      for (const optionValue of Object.keys(optionMap)) {
        if (allowedValues.includes(optionValue)) continue
        throw new ApiError('INVALID_PARAMS', {
          code: 'CAPABILITY_VALUE_NOT_ALLOWED',
          field: `models[${index}].customPricing.${model.type}.optionPrices.${field}.${optionValue}`,
          allowedValues,
        })
      }
    }
  }
}

export async function getUserApiConfig(userId: string) {
  const pref = await readUserApiConfigPreference(userId)
  const providers = decryptStoredProviders(parseStoredProviders(pref?.customProviders))

  const billingMode = await getBillingMode()
  const parsedModels = parseStoredModels(
    pref?.customModels,
    validateOpenAICompatMediaTemplate,
  )
  const models = billingMode === 'OFF' ? parsedModels : sanitizeModelsForBilling(parsedModels)
  const pricingDisplay = buildPricingDisplayMap()
  const pricedModels = models.map((model) => withDisplayPricing(model, pricingDisplay))

  const disabledPresets = buildGeminiCompatibleDisabledPresets({
    providers,
    models: pricedModels,
    pricingDisplay,
  })

  const rawDefaults = buildRawDefaultModels({
    analysisModel: pref?.analysisModel,
    characterModel: pref?.characterModel,
    locationModel: pref?.locationModel,
    storyboardModel: pref?.storyboardModel,
    editModel: pref?.editModel,
    videoModel: pref?.videoModel,
    audioModel: pref?.audioModel,
    lipSyncModel: pref?.lipSyncModel,
    voiceDesignModel: pref?.voiceDesignModel,
  })
  const defaultModels = billingMode === 'OFF'
    ? rawDefaults
    : sanitizeDefaultModelsForBilling(rawDefaults)
  const capabilityDefaults = sanitizeCapabilitySelectionsAgainstModels(
    parseStoredCapabilitySelections(pref?.capabilityDefaults, 'capabilityDefaults'),
    [...models, ...disabledPresets],
  )
  const workflowConcurrency = readWorkflowConcurrencyFromPreference(pref ?? {})

  return {
    models: [...pricedModels, ...disabledPresets],
    providers,
    defaultModels,
    capabilityDefaults,
    workflowConcurrency,
    pricingDisplay,
  }
}

export async function updateUserApiConfig(userId: string, body: ApiConfigPutBody) {
  const normalizedModelsInput = body.models === undefined
    ? undefined
    : normalizeModelList(body.models, validateOpenAICompatMediaTemplate)
  const normalizedProviders = body.providers === undefined ? undefined : normalizeProvidersInput(body.providers)
  const normalizedDefaults = body.defaultModels === undefined ? undefined : normalizeDefaultModelsInput(body.defaultModels)
  const normalizedCapabilityDefaults = body.capabilityDefaults === undefined
    ? undefined
    : normalizeCapabilitySelectionsInput(body.capabilityDefaults)
  const normalizedWorkflowConcurrency = body.workflowConcurrency === undefined
    ? undefined
    : normalizeWorkflowConcurrencyInput(body.workflowConcurrency)
  const billingMode = await getBillingMode()

  const updateData: Record<string, unknown> = {}
  const existingPref = await readUserApiConfigExistingPreference(userId)
  const existingProviders = parseStoredProviders(existingPref?.customProviders)
  const existingModels = parseStoredModels(
    existingPref?.customModels,
    validateOpenAICompatMediaTemplate,
  )
  const normalizedModels = normalizedModelsInput === undefined
    ? undefined
    : resolveStoredMediaTemplates(resolveStoredLlmProtocols(normalizedModelsInput, existingModels), existingModels)

  const providerSourceForValidation = normalizedProviders ?? existingProviders
  if (normalizedModels !== undefined) {
    validateModelProviderConsistency(normalizedModels, providerSourceForValidation)
    validateModelProviderTypeSupport(normalizedModels, providerSourceForValidation)
    validateCustomPricingCapabilityMappings(normalizedModels)
    if (billingMode !== 'OFF') {
      validateBillableModelPricing(normalizedModels)
    }
    updateData.customModels = JSON.stringify(normalizedModels)
  }

  if (normalizedProviders !== undefined) {
    const providersToSave = serializeProvidersForStorage({
      normalizedProviders,
      existingProviders,
    })
    updateData.customProviders = JSON.stringify(providersToSave)
  }

  if (normalizedDefaults !== undefined) {
    if (billingMode !== 'OFF') {
      validateDefaultModelPricing(normalizedDefaults)
    }
    applyDefaultModelUpdates(updateData, normalizedDefaults)
  }

  if (normalizedWorkflowConcurrency !== undefined) {
    applyWorkflowConcurrencyUpdates(updateData, normalizedWorkflowConcurrency)
  }

  if (normalizedCapabilityDefaults !== undefined) {
    const modelSource = normalizedModels ?? existingModels
    const cleanedCapabilityDefaults = sanitizeCapabilitySelectionsAgainstModels(
      normalizedCapabilityDefaults,
      modelSource,
    )
    validateCapabilitySelectionsAgainstModels(cleanedCapabilityDefaults, modelSource)
    updateData.capabilityDefaults = serializeCapabilitySelections(cleanedCapabilityDefaults)
  }

  await upsertUserApiConfigPreference(userId, updateData)
}
