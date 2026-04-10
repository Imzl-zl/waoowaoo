'use client'

import { apiFetch } from '@/lib/api-fetch'
import {
  encodeModelKey,
  getProviderTutorial,
  getProviderKey,
  matchesModelKey,
  PRESET_MODELS,
  PRESET_PROVIDERS,
  type CustomModel,
} from '../../types'
import type {
  ModelFormState,
  ProviderCardGroupedModels,
  ProviderCardModelType,
  ProviderCardProps,
  ProviderCardTranslator,
} from '../types'
import type { AssistantSavedEvent } from '@/components/assistant/useAssistantChat'
import type { AssistantDraftModel } from '@/components/assistant/useAssistantChat'

export type KeyTestStepStatus = 'pass' | 'fail' | 'skip'

export interface KeyTestStep {
  name: string
  status: KeyTestStepStatus
  message: string
  model?: string
  detail?: string
}

export type KeyTestStatus = 'idle' | 'testing' | 'passed' | 'failed'

export const EMPTY_MODEL_FORM: ModelFormState = {
  name: '',
  modelId: '',
  enableCustomPricing: false,
  priceInput: '',
  priceOutput: '',
  basePrice: '',
  optionPricesJson: '',
}

type AddModelCustomPricing = {
  llm?: { inputPerMillion?: number; outputPerMillion?: number }
  image?: { basePrice?: number; optionPrices?: Record<string, Record<string, number>> }
  video?: { basePrice?: number; optionPrices?: Record<string, Record<string, number>> }
}

type BuildCustomPricingResult =
  | { ok: true; customPricing?: AddModelCustomPricing }
  | { ok: false; reason: 'invalid' }

interface ProviderConnectionPayload {
  apiType: string
  apiKey: string
  baseUrl?: string
  llmModel?: string
}

type LlmProtocolType = 'responses' | 'chat-completions'

type ProbeModelLlmProtocolSuccessResponse = {
  success: true
  protocol: LlmProtocolType
  checkedAt: string
}

type ProbeModelLlmProtocolFailureResponse = {
  success: false
  code?: string
}

function isLlmProtocol(value: unknown): value is LlmProtocolType {
  return value === 'responses' || value === 'chat-completions'
}

function readProbeFailureCode(value: unknown): string {
  return typeof value === 'string' ? value : 'PROBE_INCONCLUSIVE'
}

export function shouldProbeModelLlmProtocol(params: {
  providerId: string
  modelType: ProviderCardModelType
}): boolean {
  return getProviderKey(params.providerId) === 'openai-compatible' && params.modelType === 'llm'
}

export function shouldReprobeModelLlmProtocol(params: {
  providerId: string
  originalModel: CustomModel
  nextModelId: string
}): boolean {
  if (!shouldProbeModelLlmProtocol({ providerId: params.providerId, modelType: 'llm' })) return false
  if (params.originalModel.type !== 'llm') return false
  if (getProviderKey(params.originalModel.provider) !== 'openai-compatible') return false
  return params.originalModel.modelId !== params.nextModelId || params.originalModel.provider !== params.providerId
}

export async function probeModelLlmProtocolViaApi(params: {
  providerId: string
  modelId: string
}): Promise<{ llmProtocol: LlmProtocolType; llmProtocolCheckedAt: string }> {
  const response = await apiFetch('/api/user/api-config/probe-model-llm-protocol', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId: params.providerId,
      modelId: params.modelId,
    }),
  })
  if (!response.ok) {
    throw new Error('MODEL_LLM_PROTOCOL_PROBE_REQUEST_FAILED')
  }

  const payload = await response.json() as ProbeModelLlmProtocolSuccessResponse | ProbeModelLlmProtocolFailureResponse
  if (!payload.success) {
    throw new Error(readProbeFailureCode(payload.code))
  }
  if (!isLlmProtocol(payload.protocol)) {
    throw new Error('MODEL_LLM_PROTOCOL_PROBE_INVALID_PROTOCOL')
  }

  const checkedAt = typeof payload.checkedAt === 'string' && payload.checkedAt.trim().length > 0
    ? payload.checkedAt.trim()
    : new Date().toISOString()

  return {
    llmProtocol: payload.protocol,
    llmProtocolCheckedAt: checkedAt,
  }
}

export function pickConfiguredLlmModel(params: {
  models: CustomModel[]
  defaultAnalysisModel?: string
}): string | undefined {
  const enabledLlmModels = params.models.filter((model) => model.type === 'llm' && model.enabled)
  if (enabledLlmModels.length === 0) return undefined
  const preferredModel = enabledLlmModels.find((model) => model.modelKey === params.defaultAnalysisModel)
  return (preferredModel ?? enabledLlmModels[0])?.modelId
}

export function buildProviderConnectionPayload(params: {
  providerKey: string
  apiKey: string
  baseUrl?: string
  llmModel?: string
}): ProviderConnectionPayload {
  const apiKey = params.apiKey.trim()
  const compatibleBaseUrl = params.baseUrl?.trim()
  const llmModel = params.llmModel?.trim()
  const isCompatibleProvider =
    params.providerKey === 'openai-compatible' || params.providerKey === 'gemini-compatible'

  if (isCompatibleProvider && compatibleBaseUrl) {
    return {
      apiType: params.providerKey,
      apiKey,
      baseUrl: compatibleBaseUrl,
      ...(llmModel ? { llmModel } : {}),
    }
  }

  return {
    apiType: params.providerKey,
    apiKey,
    ...(llmModel ? { llmModel } : {}),
  }
}

export function getProviderCardMeta(params: {
  providerId: string
  onUpdateBaseUrl?: ProviderCardProps['onUpdateBaseUrl']
}) {
  const providerKey = getProviderKey(params.providerId)

  return {
    providerKey,
    isPresetProvider: PRESET_PROVIDERS.some((provider) => provider.id === params.providerId),
    showBaseUrlEdit:
      ['gemini-compatible', 'openai-compatible'].includes(providerKey) &&
      Boolean(params.onUpdateBaseUrl),
    tutorial: getProviderTutorial(params.providerId),
  }
}

export function groupModelsByType(models: CustomModel[]): ProviderCardGroupedModels {
  const groupedModels: ProviderCardGroupedModels = {}

  for (const model of models) {
    const groupedType = toProviderCardModelType(model.type)
    if (!groupedType) continue
    if (!groupedModels[groupedType]) {
      groupedModels[groupedType] = []
    }
    groupedModels[groupedType]!.push(model)
  }

  return groupedModels
}

export function isPresetModelKey(modelKey: string): boolean {
  return PRESET_MODELS.some((model) => encodeModelKey(model.provider, model.modelId) === modelKey)
}

export function isDefaultProviderModel(
  model: CustomModel,
  defaultModels: ProviderCardProps['defaultModels'],
): boolean {
  if (model.type === 'llm' && (
    matchesModelKey(defaultModels.analysisModel, model.provider, model.modelId) ||
    matchesModelKey(defaultModels.characterModel, model.provider, model.modelId) ||
    matchesModelKey(defaultModels.locationModel, model.provider, model.modelId) ||
    matchesModelKey(defaultModels.storyboardModel, model.provider, model.modelId) ||
    matchesModelKey(defaultModels.editModel, model.provider, model.modelId)
  )) {
    return true
  }
  if (model.type === 'image' && matchesModelKey(defaultModels.characterModel, model.provider, model.modelId)) {
    return true
  }
  if (model.type === 'video' && matchesModelKey(defaultModels.videoModel, model.provider, model.modelId)) {
    return true
  }
  if (model.type === 'audio' && matchesModelKey(defaultModels.audioModel, model.provider, model.modelId)) {
    return true
  }
  if (model.type === 'lipsync' && matchesModelKey(defaultModels.lipSyncModel, model.provider, model.modelId)) {
    return true
  }
  return false
}

export function resolveProviderProbeFailureMessage(
  error: unknown,
  t: ProviderCardTranslator,
): string {
  const code = error instanceof Error ? error.message : ''
  if (code === 'PROBE_AUTH_FAILED') return t('probeAuthFailed')
  if (code === 'PROBE_INCONCLUSIVE') return t('probeInconclusive')
  if (code === 'MODEL_LLM_PROTOCOL_PROBE_REQUEST_FAILED') return t('probeRequestFailed')
  return t('probeLlmProtocolFailed')
}

export function buildCustomPricingFromModelForm(
  modelType: ProviderCardModelType,
  form: ModelFormState,
  options: { needsCustomPricing: boolean },
): BuildCustomPricingResult {
  if (!options.needsCustomPricing || form.enableCustomPricing !== true) {
    return { ok: true }
  }

  if (modelType === 'llm') {
    const inputVal = parseFloat(form.priceInput || '')
    const outputVal = parseFloat(form.priceOutput || '')
    if (!Number.isFinite(inputVal) || inputVal < 0 || !Number.isFinite(outputVal) || outputVal < 0) {
      return { ok: false, reason: 'invalid' }
    }
    return {
      ok: true,
      customPricing: {
        llm: {
          inputPerMillion: inputVal,
          outputPerMillion: outputVal,
        },
      },
    }
  }

  if (modelType === 'image' || modelType === 'video') {
    const basePriceRaw = parseFloat(form.basePrice || '')
    const hasBasePrice = Number.isFinite(basePriceRaw) && basePriceRaw >= 0
    let optionPrices: Record<string, Record<string, number>> | undefined

    if ((form.optionPricesJson || '').trim()) {
      try {
        const parsed = JSON.parse(form.optionPricesJson || '')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && isValidOptionPrices(parsed)) {
          optionPrices = parsed as Record<string, Record<string, number>>
        } else {
          return { ok: false, reason: 'invalid' }
        }
      } catch {
        return { ok: false, reason: 'invalid' }
      }
    }

    if (!hasBasePrice && !optionPrices) {
      return { ok: false, reason: 'invalid' }
    }

    return {
      ok: true,
      customPricing: modelType === 'image'
        ? {
          image: {
            ...(hasBasePrice ? { basePrice: basePriceRaw } : {}),
            ...(optionPrices ? { optionPrices } : {}),
          },
        }
        : {
          video: {
            ...(hasBasePrice ? { basePrice: basePriceRaw } : {}),
            ...(optionPrices ? { optionPrices } : {}),
          },
        },
    }
  }

  return { ok: true }
}

export function toProviderCardModelType(type: CustomModel['type']): ProviderCardModelType | null {
  if (type === 'llm' || type === 'image' || type === 'video' || type === 'audio') return type
  if (type === 'lipsync') return 'audio'
  return null
}

export function getAssistantSavedModelLabel(event: AssistantSavedEvent): string {
  const draftName = event.draftModel?.name?.trim()
  if (draftName) return draftName
  const tail = event.savedModelKey.split('::').pop()
  const modelId = typeof tail === 'string' ? tail.trim() : ''
  return modelId || event.savedModelKey
}

export function buildMaskedKey(apiKey?: string) {
  const key = apiKey || ''
  if (key.length <= 8) return '•'.repeat(key.length)
  return `${key.slice(0, 4)}${'•'.repeat(50)}`
}

export function upsertModelFromAssistantDraft(params: {
  draft: AssistantDraftModel
  allModels?: CustomModel[]
  models: CustomModel[]
  onAddModel: (model: Omit<CustomModel, 'enabled'>) => void
  onUpdateModel?: (modelKey: string, updates: Partial<CustomModel>) => void
}) {
  const modelKey = encodeModelKey(params.draft.provider, params.draft.modelId)
  const checkedAt = new Date().toISOString()
  const currentModels = params.allModels || params.models
  const existed = currentModels.find((item) => item.modelKey === modelKey)
  if (existed) {
    params.onUpdateModel?.(modelKey, {
      name: params.draft.name,
      modelId: params.draft.modelId,
      provider: params.draft.provider,
      compatMediaTemplate: params.draft.compatMediaTemplate,
      compatMediaTemplateCheckedAt: checkedAt,
      compatMediaTemplateSource: 'ai',
    })
    return
  }

  params.onAddModel({
    modelId: params.draft.modelId,
    modelKey,
    name: params.draft.name,
    type: params.draft.type,
    provider: params.draft.provider,
    price: 0,
    compatMediaTemplate: params.draft.compatMediaTemplate,
    compatMediaTemplateCheckedAt: checkedAt,
    compatMediaTemplateSource: 'ai',
  })
}

function isValidOptionPrices(value: unknown): value is Record<string, Record<string, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((group) => {
    if (!group || typeof group !== 'object' || Array.isArray(group)) return false
    return Object.values(group).every((price) => typeof price === 'number' && Number.isFinite(price) && price >= 0)
  })
}
