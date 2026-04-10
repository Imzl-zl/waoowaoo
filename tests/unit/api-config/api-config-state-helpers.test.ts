import { describe, expect, it } from 'vitest'
import {
  buildApiConfigStateFromResponse,
  clearUnavailableDefaultModels,
  replaceDefaultModelKey,
} from '@/app/[locale]/profile/components/api-config/config-helpers'
import type { Provider } from '@/app/[locale]/profile/components/api-config/types'

describe('api config state helpers', () => {
  it('builds merged provider/model state from api response', () => {
    const presetProviders: Provider[] = [
      { id: 'google', name: 'Google AI Studio' },
      { id: 'ark', name: 'Volcengine Ark' },
    ]

    const result = buildApiConfigStateFromResponse({
      presetProviders,
      data: {
        providers: [{ id: 'google', name: 'Old Google', apiKey: 'g-key' }],
        models: [{
          provider: 'google',
          modelId: 'gemini-2.5-pro',
          modelKey: 'google::gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          type: 'llm',
          price: 0,
          enabled: true,
        }],
        defaultModels: { analysisModel: 'google::gemini-2.5-pro' },
        workflowConcurrency: { analysis: 3, image: 4, video: 5 },
        capabilityDefaults: { 'google::gemini-2.5-pro': { tier: 'high' } },
      },
    })

    expect(result.providers.map((provider) => provider.id)).toEqual(['google', 'ark'])
    expect(result.providers[0]).toMatchObject({
      id: 'google',
      name: 'Google AI Studio',
      apiKey: 'g-key',
      hasApiKey: true,
    })
    expect(result.defaultModels.analysisModel).toBe('google::gemini-2.5-pro')
    expect(result.workflowConcurrency).toEqual({ analysis: 3, image: 4, video: 5 })
    expect(result.capabilityDefaults).toEqual({ 'google::gemini-2.5-pro': { tier: 'high' } })
  })

  it('clears removed default model keys', () => {
    const next = clearUnavailableDefaultModels(
      {
        analysisModel: 'llm::a',
        videoModel: 'video::b',
      },
      new Set(['llm::a']),
    )

    expect(next).toEqual({
      analysisModel: 'llm::a',
      videoModel: '',
    })
  })

  it('replaces moved default model keys', () => {
    const next = replaceDefaultModelKey(
      {
        analysisModel: 'provider::old',
        storyboardModel: 'provider::old',
        videoModel: 'provider::other',
      },
      'provider::old',
      'provider::new',
    )

    expect(next).toEqual({
      analysisModel: 'provider::new',
      storyboardModel: 'provider::new',
      videoModel: 'provider::other',
    })
  })
})
