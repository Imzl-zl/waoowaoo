'use client'

import type { CapabilitySelections, CapabilityValue } from '@/lib/model-config-contract'
import {
  DEFAULT_ANALYSIS_WORKFLOW_CONCURRENCY,
  DEFAULT_IMAGE_WORKFLOW_CONCURRENCY,
  DEFAULT_VIDEO_WORKFLOW_CONCURRENCY,
  normalizeWorkflowConcurrencyValue,
} from '@/lib/workflow-concurrency'
import {
  type CustomModel,
  encodeModelKey,
  getProviderKey,
  isPresetComingSoonModelKey,
  PRESET_MODELS,
  type PricingDisplayItem,
  type PricingDisplayMap,
  type Provider,
} from './types'
import type { DefaultModels, WorkflowConcurrency } from './hook-types'

export const DEFAULT_MODEL_FIELDS = [
  'analysisModel',
  'characterModel',
  'locationModel',
  'storyboardModel',
  'editModel',
  'videoModel',
  'audioModel',
  'lipSyncModel',
  'voiceDesignModel',
] as const satisfies ReadonlyArray<keyof DefaultModels>

export const DEFAULT_WORKFLOW_CONCURRENCY: WorkflowConcurrency = {
  analysis: DEFAULT_ANALYSIS_WORKFLOW_CONCURRENCY,
  image: DEFAULT_IMAGE_WORKFLOW_CONCURRENCY,
  video: DEFAULT_VIDEO_WORKFLOW_CONCURRENCY,
}

const PRICING_DISPLAY_ALIASES: Readonly<Record<string, string>> = {
  'gemini-compatible': 'google',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function composePricingDisplayKey(type: CustomModel['type'], provider: string, modelId: string): string {
  return `${type}::${provider}::${modelId}`
}

function resolvePricingDisplay(
  map: PricingDisplayMap,
  type: CustomModel['type'],
  provider: string,
  modelId: string,
): PricingDisplayItem | null {
  const exact = map[composePricingDisplayKey(type, provider, modelId)]
  if (exact) return exact

  const providerKey = getProviderKey(provider)
  if (providerKey !== provider) {
    const fallback = map[composePricingDisplayKey(type, providerKey, modelId)]
    if (fallback) return fallback
  }

  const aliasTarget = PRICING_DISPLAY_ALIASES[providerKey]
  if (!aliasTarget) return null
  return map[composePricingDisplayKey(type, aliasTarget, modelId)] || null
}

export function mergeProvidersForDisplay(
  savedProviders: Provider[],
  presetProviders: Provider[],
): Provider[] {
  const merged: Provider[] = []
  const seenProviderIds = new Set<string>()
  const seenPresetKeys = new Set<string>()

  for (const savedProvider of savedProviders) {
    if (seenProviderIds.has(savedProvider.id)) continue
    seenProviderIds.add(savedProvider.id)

    const providerKey = getProviderKey(savedProvider.id)
    const matchedPreset = presetProviders.find((presetProvider) => presetProvider.id === providerKey)
    if (matchedPreset) {
      const apiKey = savedProvider.apiKey || ''
      const providerBaseUrl = providerKey === 'minimax'
        ? matchedPreset.baseUrl
        : (savedProvider.baseUrl || matchedPreset.baseUrl)
      merged.push({
        ...matchedPreset,
        apiKey,
        hasApiKey: apiKey.length > 0,
        hidden: savedProvider.hidden === true,
        baseUrl: providerBaseUrl,
        apiMode: savedProvider.apiMode,
        gatewayRoute: savedProvider.gatewayRoute,
      })
      seenPresetKeys.add(providerKey)
      continue
    }

    merged.push({
      ...savedProvider,
      hasApiKey: !!savedProvider.apiKey,
    })
  }

  for (const presetProvider of presetProviders) {
    if (seenPresetKeys.has(presetProvider.id)) continue
    merged.push({
      ...presetProvider,
      apiKey: '',
      hasApiKey: false,
      hidden: false,
    })
  }

  return merged
}

export function parsePricingDisplayMap(raw: unknown): PricingDisplayMap {
  if (!isRecord(raw)) return {}

  const map: PricingDisplayMap = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue
    const min = typeof value.min === 'number' && Number.isFinite(value.min) ? value.min : null
    const max = typeof value.max === 'number' && Number.isFinite(value.max) ? value.max : null
    const label = typeof value.label === 'string' ? value.label.trim() : ''
    const input = typeof value.input === 'number' && Number.isFinite(value.input) ? value.input : undefined
    const output = typeof value.output === 'number' && Number.isFinite(value.output) ? value.output : undefined
    if (min === null || max === null || !label) continue
    map[key] = {
      min,
      max,
      label,
      ...(typeof input === 'number' ? { input } : {}),
      ...(typeof output === 'number' ? { output } : {}),
    }
  }
  return map
}

export function parseWorkflowConcurrency(raw: unknown): WorkflowConcurrency {
  if (!isRecord(raw)) return DEFAULT_WORKFLOW_CONCURRENCY
  return {
    analysis: normalizeWorkflowConcurrencyValue(raw.analysis, DEFAULT_WORKFLOW_CONCURRENCY.analysis),
    image: normalizeWorkflowConcurrencyValue(raw.image, DEFAULT_WORKFLOW_CONCURRENCY.image),
    video: normalizeWorkflowConcurrencyValue(raw.video, DEFAULT_WORKFLOW_CONCURRENCY.video),
  }
}

export function applyPricingDisplay(model: CustomModel, map: PricingDisplayMap): CustomModel {
  const pricing = resolvePricingDisplay(map, model.type, model.provider, model.modelId)
  if (!pricing) {
    if (model.priceLabel && model.priceLabel !== '--') {
      return model
    }
    return {
      ...model,
      price: 0,
      priceLabel: '--',
      priceMin: undefined,
      priceMax: undefined,
      priceInput: undefined,
      priceOutput: undefined,
    }
  }

  return {
    ...model,
    price: pricing.min,
    priceMin: pricing.min,
    priceMax: pricing.max,
    priceLabel: pricing.label,
    ...(typeof pricing.input === 'number' ? { priceInput: pricing.input } : {}),
    ...(typeof pricing.output === 'number' ? { priceOutput: pricing.output } : {}),
  }
}

export function createInitialProviders(presetProviders: Provider[]): Provider[] {
  return presetProviders.map((provider) => ({ ...provider, apiKey: '', hasApiKey: false }))
}

export function createInitialModels(): CustomModel[] {
  return PRESET_MODELS.map((model) => {
    const modelKey = encodeModelKey(model.provider, model.modelId)
    return {
      ...model,
      modelKey,
      price: 0,
      priceLabel: '--',
      enabled: !isPresetComingSoonModelKey(modelKey),
    }
  })
}

export function buildDisplayModels(rawModels: CustomModel[], pricingDisplay: PricingDisplayMap): CustomModel[] {
  const savedModels: CustomModel[] = []
  const seen = new Set<string>()
  const normalizedModels = rawModels.map((model) => ({
    ...model,
    modelKey: model.modelKey || encodeModelKey(model.provider, model.modelId),
  }))
  for (const model of normalizedModels) {
    if (seen.has(model.modelKey)) continue
    seen.add(model.modelKey)
    savedModels.push(model)
  }

  const hasSavedModels = savedModels.length > 0
  const allModels = PRESET_MODELS.map((preset) => {
    const presetModelKey = encodeModelKey(preset.provider, preset.modelId)
    const saved = savedModels.find((model) => model.modelKey === presetModelKey)
    const alwaysEnabledPreset = preset.type === 'lipsync'
    const mergedPreset: CustomModel = {
      ...preset,
      modelKey: presetModelKey,
      enabled: isPresetComingSoonModelKey(presetModelKey)
        ? false
        : (hasSavedModels ? (alwaysEnabledPreset || !!saved) : false),
      price: 0,
      capabilities: saved?.capabilities ?? preset.capabilities,
    }
    return applyPricingDisplay(mergedPreset, pricingDisplay)
  })

  const customModels = savedModels
    .filter((model) =>
      !PRESET_MODELS.find((preset) => encodeModelKey(preset.provider, preset.modelId) === model.modelKey))
    .map((model) => ({
      ...applyPricingDisplay(model, pricingDisplay),
      enabled: (model as CustomModel & { enabled?: boolean }).enabled !== false,
    }))

  return [...allModels, ...customModels]
}

export function clearUnavailableDefaultModels(
  defaults: DefaultModels,
  remainingModelKeys: Set<string>,
): DefaultModels {
  const next = { ...defaults }
  for (const field of DEFAULT_MODEL_FIELDS) {
    const current = next[field]
    if (current && !remainingModelKeys.has(current)) {
      next[field] = ''
    }
  }
  return next
}

export function replaceDefaultModelKey(
  defaults: DefaultModels,
  previousKey: string,
  nextKey: string,
): DefaultModels {
  const next = { ...defaults }
  for (const field of DEFAULT_MODEL_FIELDS) {
    if (next[field] === previousKey) {
      next[field] = nextKey
    }
  }
  return next
}

export function applyCapabilityDefaultsSelection(
  previous: CapabilitySelections,
  modelKey: string,
  capabilityFieldsToDefault?: Array<{ field: string; options: CapabilityValue[] }>,
): { next: CapabilitySelections; changed: boolean } {
  if (!capabilityFieldsToDefault || capabilityFieldsToDefault.length === 0) {
    return { next: previous, changed: false }
  }

  const next: CapabilitySelections = { ...previous }
  const current = { ...(next[modelKey] || {}) }
  let changed = false
  for (const definition of capabilityFieldsToDefault) {
    if (current[definition.field] === undefined && definition.options.length > 0) {
      current[definition.field] = definition.options[0]
      changed = true
    }
  }

  if (!changed) return { next: previous, changed: false }
  next[modelKey] = current
  return { next, changed: true }
}

export function buildApiConfigStateFromResponse(input: {
  data: {
    providers?: Provider[]
    models?: CustomModel[]
    defaultModels?: DefaultModels
    workflowConcurrency?: unknown
    capabilityDefaults?: unknown
    pricingDisplay?: unknown
  }
  presetProviders: Provider[]
}) {
  const pricingDisplay = parsePricingDisplayMap(input.data.pricingDisplay)
  const providers = mergeProvidersForDisplay(input.data.providers || [], input.presetProviders)
  const models = buildDisplayModels(input.data.models || [], pricingDisplay)
  return {
    providers,
    models,
    defaultModels: input.data.defaultModels || {},
    workflowConcurrency: parseWorkflowConcurrency(input.data.workflowConcurrency),
    capabilityDefaults:
      input.data.capabilityDefaults && typeof input.data.capabilityDefaults === 'object'
        ? (input.data.capabilityDefaults as CapabilitySelections)
        : {},
  }
}
