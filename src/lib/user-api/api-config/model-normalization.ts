import { getProviderKey } from '@/lib/api-config'
import { ApiError } from '@/lib/api-errors'
import {
  composeModelKey,
  parseModelKeyStrict,
  type UnifiedModelType,
} from '@/lib/model-config-contract'
import { findBuiltinCapabilities } from '@/lib/model-capabilities/catalog'
import type {
  OpenAICompatMediaTemplate,
  OpenAICompatMediaTemplateSource,
} from '@/lib/openai-compat-media-template'
import { parseStoredPayloadArrayOrThrow } from './stored-payload'
import type {
  ApiModeType,
  GatewayRouteType,
  LlmProtocolType,
  StoredModel,
  StoredModelCustomPricing,
  StoredModelMediaCustomPricing,
  StoredProvider,
} from './types'

const OFFICIAL_ONLY_PROVIDER_KEYS = new Set(['bailian', 'siliconflow'])
const RETIRED_PROVIDER_KEYS = new Set(['qwen'])
const MINIMAX_OFFICIAL_BASE_URL = 'https://api.minimaxi.com/v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isUnifiedModelType(value: unknown): value is UnifiedModelType {
  return (
    value === 'llm'
    || value === 'image'
    || value === 'video'
    || value === 'audio'
    || value === 'lipsync'
  )
}

function isApiMode(value: unknown): value is ApiModeType {
  return value === 'gemini-sdk' || value === 'openai-official'
}

function isGatewayRoute(value: unknown): value is GatewayRouteType {
  return value === 'official' || value === 'openai-compat'
}

function isLlmProtocol(value: unknown): value is LlmProtocolType {
  return value === 'responses' || value === 'chat-completions'
}

function isMediaTemplateSource(value: unknown): value is OpenAICompatMediaTemplateSource {
  return value === 'ai' || value === 'manual'
}

function normalizeMinimaxProviderBaseUrl(input: {
  providerId: string
  baseUrl?: string
  strict: boolean
  field: string
}): string | undefined {
  if (getProviderKey(input.providerId) !== 'minimax') return input.baseUrl
  if (!input.baseUrl) return MINIMAX_OFFICIAL_BASE_URL
  if (input.baseUrl === MINIMAX_OFFICIAL_BASE_URL) return MINIMAX_OFFICIAL_BASE_URL
  if (input.strict) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PROVIDER_BASEURL_INVALID',
      field: input.field,
    })
  }
  return MINIMAX_OFFICIAL_BASE_URL
}

export function resolveProviderGatewayRoute(
  providerId: string,
  rawGatewayRoute: unknown,
): GatewayRouteType {
  const providerKey = getProviderKey(providerId)
  const isOpenAICompatibleProvider = providerKey === 'openai-compatible'
  const isGeminiCompatibleProvider = providerKey === 'gemini-compatible'

  if (rawGatewayRoute !== undefined && !isGatewayRoute(rawGatewayRoute)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PROVIDER_GATEWAY_ROUTE_INVALID',
    })
  }

  if (isOpenAICompatibleProvider) {
    if (rawGatewayRoute === 'official') {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_GATEWAY_ROUTE_INVALID',
      })
    }
    return 'openai-compat'
  }

  if (isGeminiCompatibleProvider) {
    if (rawGatewayRoute === 'openai-compat') {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_GATEWAY_ROUTE_INVALID',
      })
    }
    return 'official'
  }

  if (OFFICIAL_ONLY_PROVIDER_KEYS.has(providerKey)) {
    if (rawGatewayRoute === 'openai-compat') {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_GATEWAY_ROUTE_INVALID',
      })
    }
    return 'official'
  }

  return rawGatewayRoute === 'openai-compat' ? 'openai-compat' : 'official'
}

export function resolveProviderByIdOrKey(providers: StoredProvider[], providerId: string): StoredProvider | null {
  const exact = providers.find((provider) => provider.id === providerId)
  if (exact) return exact

  const providerKey = getProviderKey(providerId)
  const candidates = providers.filter((provider) => getProviderKey(provider.id) === providerKey)
  if (candidates.length === 0) return null
  if (candidates.length > 1) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PROVIDER_AMBIGUOUS',
      field: 'providers',
    })
  }

  return candidates[0]
}

function withBuiltinCapabilities(model: StoredModel): StoredModel {
  const capabilities = findBuiltinCapabilities(model.type, model.provider, model.modelId)
  if (!capabilities) {
    return {
      ...model,
      capabilities: undefined,
    }
  }

  return {
    ...model,
    capabilities,
  }
}

function readNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined
  }
  return value
}

function parseNonNegativeNumberStrict(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined
  const parsed = readNonNegativeNumber(value)
  if (parsed !== undefined) return parsed
  throw new ApiError('INVALID_PARAMS', {
    code: 'MODEL_CUSTOM_PRICING_INVALID',
    field,
  })
}

function validateAllowedObjectKeys(
  raw: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
) {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(raw)) {
    if (allowedSet.has(key)) continue
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_CUSTOM_PRICING_INVALID',
      field: `${field}.${key}`,
    })
  }
}

function normalizeOptionPrices(
  raw: unknown,
  options?: { strict?: boolean; field?: string },
): Record<string, Record<string, number>> | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isRecord(raw)) {
    if (options?.strict) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_CUSTOM_PRICING_INVALID',
        field: options.field || 'models.customPricing.optionPrices',
      })
    }
    return undefined
  }

  const normalized: Record<string, Record<string, number>> = {}
  for (const [field, rawFieldPricing] of Object.entries(raw)) {
    if (!isRecord(rawFieldPricing)) {
      if (options?.strict) {
        throw new ApiError('INVALID_PARAMS', {
          code: 'MODEL_CUSTOM_PRICING_INVALID',
          field: options.field ? `${options.field}.${field}` : `models.customPricing.optionPrices.${field}`,
        })
      }
      continue
    }
    const fieldPricing: Record<string, number> = {}
    for (const [optionValue, rawAmount] of Object.entries(rawFieldPricing)) {
      const amount = options?.strict
        ? parseNonNegativeNumberStrict(
          rawAmount,
          options.field
            ? `${options.field}.${field}.${optionValue}`
            : `models.customPricing.optionPrices.${field}.${optionValue}`,
        )
        : readNonNegativeNumber(rawAmount)
      if (amount === undefined) continue
      fieldPricing[optionValue] = amount
    }
    if (Object.keys(fieldPricing).length > 0) {
      normalized[field] = fieldPricing
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function normalizeMediaCustomPricing(
  raw: unknown,
  options?: { strict?: boolean; field?: string },
): StoredModelMediaCustomPricing | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isRecord(raw)) {
    if (options?.strict) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_CUSTOM_PRICING_INVALID',
        field: options.field || 'models.customPricing',
      })
    }
    return undefined
  }
  if (options?.strict) {
    validateAllowedObjectKeys(raw, ['basePrice', 'optionPrices'], options.field || 'models.customPricing')
  }
  const basePrice = options?.strict
    ? parseNonNegativeNumberStrict(raw.basePrice, options.field ? `${options.field}.basePrice` : 'models.customPricing.basePrice')
    : readNonNegativeNumber(raw.basePrice)
  const optionPrices = normalizeOptionPrices(raw.optionPrices, {
    strict: options?.strict,
    field: options?.field ? `${options.field}.optionPrices` : 'models.customPricing.optionPrices',
  })
  if (basePrice === undefined && optionPrices === undefined) return undefined

  return {
    ...(basePrice !== undefined ? { basePrice } : {}),
    ...(optionPrices ? { optionPrices } : {}),
  }
}

function normalizeCustomPricing(
  raw: unknown,
  options?: { strict?: boolean; field?: string },
): StoredModelCustomPricing | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isRecord(raw)) {
    if (options?.strict) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_CUSTOM_PRICING_INVALID',
        field: options.field || 'models.customPricing',
      })
    }
    return undefined
  }
  if (options?.strict) {
    validateAllowedObjectKeys(raw, ['llm', 'image', 'video', 'input', 'output'], options.field || 'models.customPricing')
  }

  const llmRaw = isRecord(raw.llm) ? raw.llm : raw
  if (options?.strict && raw.llm !== undefined && !isRecord(raw.llm)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_CUSTOM_PRICING_INVALID',
      field: options.field ? `${options.field}.llm` : 'models.customPricing.llm',
    })
  }
  if (options?.strict && isRecord(raw.llm)) {
    validateAllowedObjectKeys(raw.llm, ['inputPerMillion', 'outputPerMillion'], options.field ? `${options.field}.llm` : 'models.customPricing.llm')
  }
  const inputPerMillion = options?.strict
    ? parseNonNegativeNumberStrict(llmRaw.inputPerMillion, options.field ? `${options.field}.llm.inputPerMillion` : 'models.customPricing.llm.inputPerMillion')
    : readNonNegativeNumber(llmRaw.inputPerMillion)
  const outputPerMillion = options?.strict
    ? parseNonNegativeNumberStrict(llmRaw.outputPerMillion, options.field ? `${options.field}.llm.outputPerMillion` : 'models.customPricing.llm.outputPerMillion')
    : readNonNegativeNumber(llmRaw.outputPerMillion)
  const legacyInput = options?.strict
    ? parseNonNegativeNumberStrict((raw as Record<string, unknown>).input, options.field ? `${options.field}.input` : 'models.customPricing.input')
    : readNonNegativeNumber((raw as Record<string, unknown>).input)
  const legacyOutput = options?.strict
    ? parseNonNegativeNumberStrict((raw as Record<string, unknown>).output, options.field ? `${options.field}.output` : 'models.customPricing.output')
    : readNonNegativeNumber((raw as Record<string, unknown>).output)
  const llm = (inputPerMillion !== undefined || outputPerMillion !== undefined || legacyInput !== undefined || legacyOutput !== undefined)
    ? {
      ...(inputPerMillion !== undefined ? { inputPerMillion } : {}),
      ...(outputPerMillion !== undefined ? { outputPerMillion } : {}),
      ...(inputPerMillion === undefined && legacyInput !== undefined ? { inputPerMillion: legacyInput } : {}),
      ...(outputPerMillion === undefined && legacyOutput !== undefined ? { outputPerMillion: legacyOutput } : {}),
    }
    : undefined
  if (
    options?.strict
    && llm
    && (
      typeof llm.inputPerMillion !== 'number'
      || typeof llm.outputPerMillion !== 'number'
    )
  ) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_CUSTOM_PRICING_INVALID',
      field: options.field ? `${options.field}.llm` : 'models.customPricing.llm',
    })
  }

  const image = normalizeMediaCustomPricing(raw.image, {
    strict: options?.strict,
    field: options?.field ? `${options.field}.image` : 'models.customPricing.image',
  })
  const video = normalizeMediaCustomPricing(raw.video, {
    strict: options?.strict,
    field: options?.field ? `${options.field}.video` : 'models.customPricing.video',
  })

  if (!llm && !image && !video) return undefined
  return {
    ...(llm ? { llm } : {}),
    ...(image ? { image } : {}),
    ...(video ? { video } : {}),
  }
}

function normalizeStoredModel(
  raw: unknown,
  index: number,
  options: {
    strictCustomPricing?: boolean
    validateMediaTemplate: (template: unknown) => { ok: boolean; template: OpenAICompatMediaTemplate | null }
  },
): StoredModel {
  if (!isRecord(raw)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_PAYLOAD_INVALID',
      field: `models[${index}]`,
    })
  }

  const modelType = raw.type
  if (!isUnifiedModelType(modelType)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_TYPE_INVALID',
      field: `models[${index}].type`,
    })
  }

  const providerFromField = readTrimmedString(raw.provider)
  const modelIdFromField = readTrimmedString(raw.modelId)
  const modelKeyFromField = readTrimmedString(raw.modelKey)
  const parsedModelKey = parseModelKeyStrict(modelKeyFromField)

  const provider = providerFromField || parsedModelKey?.provider || ''
  const modelId = modelIdFromField || parsedModelKey?.modelId || ''
  const modelKey = composeModelKey(provider, modelId)

  if (!modelKey) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_KEY_INVALID',
      field: `models[${index}].modelKey`,
    })
  }
  if (modelKeyFromField && (!parsedModelKey || parsedModelKey.modelKey !== modelKey)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_KEY_MISMATCH',
      field: `models[${index}].modelKey`,
    })
  }

  const modelName = readTrimmedString(raw.name) || modelId
  const customPricing = normalizeCustomPricing(raw.customPricing, {
    strict: options.strictCustomPricing,
    field: `models[${index}].customPricing`,
  })

  const llmProtocolRaw = raw.llmProtocol
  let llmProtocol: LlmProtocolType | undefined
  if (llmProtocolRaw !== undefined && llmProtocolRaw !== null) {
    if (!isLlmProtocol(llmProtocolRaw)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_LLM_PROTOCOL_INVALID',
        field: `models[${index}].llmProtocol`,
      })
    }
    llmProtocol = llmProtocolRaw
  }
  const llmProtocolCheckedAt = readTrimmedString(raw.llmProtocolCheckedAt) || undefined

  const compatMediaTemplateRaw = raw.compatMediaTemplate
  let compatMediaTemplate: OpenAICompatMediaTemplate | undefined
  if (compatMediaTemplateRaw !== undefined && compatMediaTemplateRaw !== null) {
    const validated = options.validateMediaTemplate(compatMediaTemplateRaw)
    if (!validated.ok || !validated.template) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_COMPAT_MEDIA_TEMPLATE_INVALID',
        field: `models[${index}].compatMediaTemplate`,
      })
    }
    compatMediaTemplate = validated.template
  }
  const compatMediaTemplateCheckedAt = readTrimmedString(raw.compatMediaTemplateCheckedAt) || undefined
  const compatMediaTemplateSourceRaw = raw.compatMediaTemplateSource
  let compatMediaTemplateSource: OpenAICompatMediaTemplateSource | undefined
  if (compatMediaTemplateSourceRaw !== undefined && compatMediaTemplateSourceRaw !== null) {
    if (!isMediaTemplateSource(compatMediaTemplateSourceRaw)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_COMPAT_MEDIA_TEMPLATE_SOURCE_INVALID',
        field: `models[${index}].compatMediaTemplateSource`,
      })
    }
    compatMediaTemplateSource = compatMediaTemplateSourceRaw
  }

  return {
    modelId,
    modelKey,
    name: modelName,
    type: modelType,
    provider,
    ...(llmProtocol ? { llmProtocol } : {}),
    ...(llmProtocolCheckedAt ? { llmProtocolCheckedAt } : {}),
    ...(compatMediaTemplate ? { compatMediaTemplate } : {}),
    ...(compatMediaTemplateCheckedAt ? { compatMediaTemplateCheckedAt } : {}),
    ...(compatMediaTemplateSource ? { compatMediaTemplateSource } : {}),
    price: 0,
    ...(customPricing ? { customPricing } : {}),
  }
}

export function normalizeProvidersInput(rawProviders: unknown): StoredProvider[] {
  if (rawProviders === undefined) return []
  if (!Array.isArray(rawProviders)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PROVIDER_PAYLOAD_INVALID',
      field: 'providers',
    })
  }

  const normalized: StoredProvider[] = []
  for (let index = 0; index < rawProviders.length; index += 1) {
    const item = rawProviders[index]
    if (!isRecord(item)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_PAYLOAD_INVALID',
        field: `providers[${index}]`,
      })
    }
    const id = readTrimmedString(item.id)
    const name = readTrimmedString(item.name)
    if (!id || !name) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_PAYLOAD_INVALID',
        field: `providers[${index}]`,
      })
    }
    const normalizedId = id.toLowerCase()
    const providerKey = getProviderKey(normalizedId)
    if (RETIRED_PROVIDER_KEYS.has(providerKey)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_NOT_SUPPORTED',
        field: `providers[${index}].id`,
      })
    }
    if (normalized.some((provider) => provider.id.toLowerCase() === normalizedId)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_DUPLICATE',
        field: `providers[${index}].id`,
      })
    }
    const apiModeRaw = item.apiMode
    if (apiModeRaw !== undefined && !isApiMode(apiModeRaw)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_APIMODE_INVALID',
        field: `providers[${index}].apiMode`,
      })
    }
    if (getProviderKey(id) === 'gemini-compatible' && apiModeRaw === 'openai-official') {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_APIMODE_INVALID',
        field: `providers[${index}].apiMode`,
      })
    }
    let gatewayRoute: GatewayRouteType
    try {
      gatewayRoute = resolveProviderGatewayRoute(id, item.gatewayRoute)
    } catch (error) {
      if (error instanceof ApiError) {
        throw new ApiError('INVALID_PARAMS', {
          code: 'PROVIDER_GATEWAY_ROUTE_INVALID',
          field: `providers[${index}].gatewayRoute`,
        })
      }
      throw error
    }
    const hiddenRaw = item.hidden
    if (hiddenRaw !== undefined && typeof hiddenRaw !== 'boolean') {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_HIDDEN_INVALID',
        field: `providers[${index}].hidden`,
      })
    }

    const baseUrl = normalizeMinimaxProviderBaseUrl({
      providerId: id,
      baseUrl: readTrimmedString(item.baseUrl) || undefined,
      strict: true,
      field: `providers[${index}].baseUrl`,
    })

    normalized.push({
      id,
      name,
      baseUrl,
      apiKey: typeof item.apiKey === 'string' ? item.apiKey.trim() : undefined,
      hidden: hiddenRaw === true,
      apiMode: apiModeRaw,
      gatewayRoute,
    })
  }

  return normalized
}

export function normalizeModelList(
  rawModels: unknown,
  validateMediaTemplate: (template: unknown) => { ok: boolean; template: OpenAICompatMediaTemplate | null },
): StoredModel[] {
  if (rawModels === undefined) return []
  if (!Array.isArray(rawModels)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_PAYLOAD_INVALID',
      field: 'models',
    })
  }

  return rawModels.map((item, index) => normalizeStoredModel(item, index, {
    strictCustomPricing: true,
    validateMediaTemplate,
  }))
}

export function parseStoredProviders(rawProviders: string | null | undefined): StoredProvider[] {
  const parsedUnknown = parseStoredPayloadArrayOrThrow(
    rawProviders,
    () =>
      new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_PAYLOAD_INVALID',
        field: 'customProviders',
      }),
  )

  const normalized: StoredProvider[] = []
  for (let index = 0; index < parsedUnknown.length; index += 1) {
    const raw = parsedUnknown[index]
    if (!isRecord(raw)) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_PAYLOAD_INVALID',
        field: `customProviders[${index}]`,
      })
    }

    const id = readTrimmedString(raw.id)
    const name = readTrimmedString(raw.name)
    if (!id || !name) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_PAYLOAD_INVALID',
        field: `customProviders[${index}]`,
      })
    }

    const providerKey = getProviderKey(id)
    const apiModeRaw = raw.apiMode
    let apiMode: ApiModeType | undefined
    if (apiModeRaw !== undefined) {
      if (!isApiMode(apiModeRaw)) {
        throw new ApiError('INVALID_PARAMS', {
          code: 'PROVIDER_APIMODE_INVALID',
          field: `customProviders[${index}].apiMode`,
        })
      }
      if (providerKey === 'gemini-compatible' && apiModeRaw === 'openai-official') {
        throw new ApiError('INVALID_PARAMS', {
          code: 'PROVIDER_APIMODE_INVALID',
          field: `customProviders[${index}].apiMode`,
        })
      }
      apiMode = apiModeRaw
    }

    let gatewayRoute: GatewayRouteType
    try {
      gatewayRoute = resolveProviderGatewayRoute(id, raw.gatewayRoute)
    } catch {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_GATEWAY_ROUTE_INVALID',
        field: `customProviders[${index}].gatewayRoute`,
      })
    }
    const hiddenRaw = raw.hidden
    if (hiddenRaw !== undefined && typeof hiddenRaw !== 'boolean') {
      throw new ApiError('INVALID_PARAMS', {
        code: 'PROVIDER_HIDDEN_INVALID',
        field: `customProviders[${index}].hidden`,
      })
    }

    const baseUrl = normalizeMinimaxProviderBaseUrl({
      providerId: id,
      baseUrl: readTrimmedString(raw.baseUrl) || undefined,
      strict: false,
      field: `customProviders[${index}].baseUrl`,
    })

    normalized.push({
      id,
      name,
      baseUrl,
      apiKey: typeof raw.apiKey === 'string' ? raw.apiKey.trim() : undefined,
      hidden: hiddenRaw === true,
      apiMode,
      gatewayRoute,
    })
  }

  return normalized
}

export function parseStoredModels(
  rawModels: string | null | undefined,
  validateMediaTemplate: (template: unknown) => { ok: boolean; template: OpenAICompatMediaTemplate | null },
): StoredModel[] {
  const parsedUnknown = parseStoredPayloadArrayOrThrow(
    rawModels,
    () =>
      new ApiError('INVALID_PARAMS', {
        code: 'MODEL_PAYLOAD_INVALID',
        field: 'customModels',
      }),
  )
  const normalized: StoredModel[] = []
  for (let index = 0; index < parsedUnknown.length; index += 1) {
    normalized.push(withBuiltinCapabilities(normalizeStoredModel(parsedUnknown[index], index, {
      validateMediaTemplate,
    })))
  }
  return normalized
}

export function validateModelProviderConsistency(models: StoredModel[], providers: StoredProvider[]) {
  for (let index = 0; index < models.length; index += 1) {
    const model = models[index]
    const matchedProvider = resolveProviderByIdOrKey(providers, model.provider)
    if (!matchedProvider) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_PROVIDER_NOT_FOUND',
        field: `models[${index}].provider`,
      })
    }
  }
}

export function validateModelProviderTypeSupport(models: StoredModel[], providers: StoredProvider[]) {
  for (let index = 0; index < models.length; index += 1) {
    const model = models[index]
    const matchedProvider = resolveProviderByIdOrKey(providers, model.provider)
    if (!matchedProvider) continue

    const providerKey = getProviderKey(matchedProvider.id)
    if (model.type === 'lipsync' && providerKey !== 'fal' && providerKey !== 'vidu' && providerKey !== 'bailian') {
      throw new ApiError('INVALID_PARAMS', {
        code: 'MODEL_PROVIDER_TYPE_UNSUPPORTED',
        field: `models[${index}].provider`,
      })
    }
  }
}
