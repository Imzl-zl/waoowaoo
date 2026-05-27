import { describe, expect, it } from 'vitest'
import {
  assertValidProductionPrepDocument,
  normalizeEpisodePlanningParams,
  normalizeProductionPrepExtractParams,
} from '@/lib/production-prep'
import { productionPrepDocument } from './helpers'

describe('production prep validation and request params', () => {
  it('accepts a valid saved document and rejects schema-invalid saves', () => {
    expect(assertValidProductionPrepDocument(productionPrepDocument()).title).toBe('River Case')
    expect(() => assertValidProductionPrepDocument({
      ...productionPrepDocument(),
      title: '',
    })).toThrow('production prep document failed validation')
  })

  it('normalizes episode planning params with defaults', () => {
    expect(normalizeEpisodePlanningParams({
      episodeCount: '8',
      targetDurationSeconds: '600',
      pacing: 'fast',
      instruction: '  tight cliffhangers  ',
    })).toEqual({
      episodeCount: 8,
      targetDurationSeconds: 600,
      minDurationSeconds: 480,
      maxDurationSeconds: 720,
      pacing: 'fast',
      instruction: 'tight cliffhangers',
      language: 'zh-CN',
    })
  })

  it('rejects invalid episode planning ranges', () => {
    expect(() => normalizeEpisodePlanningParams({
      episodeCount: 3,
      targetDurationSeconds: 600,
      minDurationSeconds: 700,
      maxDurationSeconds: 800,
    })).toThrow('episode planning parameters are invalid')
  })

  it('normalizes extract params and requires source text', () => {
    expect(normalizeProductionPrepExtractParams({
      prompt: '  A manual premise  ',
      sourceMode: 'manual',
      language: 'en',
    })).toEqual({
      sourceText: 'A manual premise',
      sourceMode: 'manual',
      title: '',
      instruction: '',
      language: 'en',
    })
    expect(() => normalizeProductionPrepExtractParams({ sourceText: '   ' }))
      .toThrow('sourceText is required')
  })
})
