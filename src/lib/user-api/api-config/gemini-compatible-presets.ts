import { getProviderKey } from '@/lib/api-config'
import { composeModelKey, type UnifiedModelType } from '@/lib/model-config-contract'
import { findBuiltinCapabilities } from '@/lib/model-capabilities/catalog'
import { withDisplayPricing } from './pricing-display'
import type {
  PricingDisplayMap,
  StoredModel,
  StoredProvider,
} from './types'

const GEMINI_COMPATIBLE_PRESETS: Array<{ type: UnifiedModelType; modelId: string; name: string }> = [
  { type: 'llm', modelId: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { type: 'llm', modelId: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { type: 'llm', modelId: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite' },
  { type: 'image', modelId: 'gemini-3-pro-image-preview', name: 'Banana Pro' },
  { type: 'image', modelId: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2' },
  { type: 'image', modelId: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  { type: 'image', modelId: 'imagen-4.0-generate-001', name: 'Imagen 4' },
  { type: 'image', modelId: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra' },
  { type: 'image', modelId: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast' },
  { type: 'video', modelId: 'veo-3.1-generate-preview', name: 'Veo 3.1' },
  { type: 'video', modelId: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast' },
  { type: 'video', modelId: 'veo-3.0-generate-001', name: 'Veo 3.0' },
  { type: 'video', modelId: 'veo-3.0-fast-generate-001', name: 'Veo 3.0 Fast' },
  { type: 'video', modelId: 'veo-2.0-generate-001', name: 'Veo 2.0' },
]

export function buildGeminiCompatibleDisabledPresets(input: {
  providers: StoredProvider[]
  models: StoredModel[]
  pricingDisplay: PricingDisplayMap
}): Array<StoredModel & { enabled: false }> {
  const savedModelKeys = new Set(input.models.map((model) => model.modelKey))
  const disabledPresets: Array<StoredModel & { enabled: false }> = []

  for (const provider of input.providers) {
    if (getProviderKey(provider.id) !== 'gemini-compatible') continue

    for (const preset of GEMINI_COMPATIBLE_PRESETS) {
      const modelKey = composeModelKey(provider.id, preset.modelId)
      if (!modelKey || savedModelKeys.has(modelKey)) continue
      savedModelKeys.add(modelKey)

      const base: StoredModel = {
        modelId: preset.modelId,
        modelKey,
        name: preset.name,
        type: preset.type,
        provider: provider.id,
        price: 0,
        capabilities: findBuiltinCapabilities(preset.type, provider.id, preset.modelId),
      }
      disabledPresets.push({ ...withDisplayPricing(base, input.pricingDisplay), enabled: false })
    }
  }

  return disabledPresets
}

