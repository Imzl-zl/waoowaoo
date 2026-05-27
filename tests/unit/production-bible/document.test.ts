import { describe, expect, it } from 'vitest'
import {
  createEmptyProductionPrepDocument,
  parseProductionPrepDocument,
  validateProductionPrepDocument,
} from '@/lib/production-bible'

function validDocument() {
  return {
    schemaVersion: 1,
    sourceMode: 'novel',
    title: 'River Case',
    bible: {
      logline: 'A detective follows a missing heir across a flood city.',
      themes: ['memory'],
    },
    assets: {
      characters: [
        { id: 'char.lead', name: 'Lin' },
      ],
      locations: [
        { id: 'loc.river', name: 'River Market' },
      ],
      props: [
        { id: 'prop.letter', name: 'Letter' },
      ],
      style: {
        visualStyle: 'grounded noir',
      },
    },
    episodePlans: [
      {
        id: 'ep.1',
        episodeNumber: 1,
        title: 'The Letter',
        targetDurationSeconds: 900,
        minDurationSeconds: 780,
        maxDurationSeconds: 960,
        beats: ['The letter arrives'],
      },
    ],
    sceneBreakdowns: [
      {
        id: 'scene.1',
        episodeId: 'ep.1',
        sceneNumber: 1,
        title: 'River clue',
        setting: 'River Market',
        estimatedDurationSeconds: 120,
        characterIds: ['char.lead'],
        locationIds: ['loc.river'],
        propIds: ['prop.letter'],
      },
    ],
    shotPlans: [
      {
        id: 'shot.1',
        sceneId: 'scene.1',
        shotNumber: 1,
        description: 'Lin finds the wet letter.',
        durationSeconds: 6,
        characterIds: ['char.lead'],
        locationIds: ['loc.river'],
        propIds: ['prop.letter'],
        imagePrompt: 'Detective at a rainy river market, holding a letter.',
      },
    ],
  }
}

describe('production prep document', () => {
  it('creates a strict empty manual document with stable defaults', () => {
    const document = createEmptyProductionPrepDocument({
      title: 'Manual seed',
      sourceMode: 'manual',
      language: 'en-US',
      createdAt: '2026-05-27T00:00:00.000Z',
    })

    expect(document).toEqual(expect.objectContaining({
      schemaVersion: 1,
      sourceMode: 'manual',
      title: 'Manual seed',
      episodePlans: [],
      sceneBreakdowns: [],
      shotPlans: [],
    }))
    expect(document.metadata).toEqual(expect.objectContaining({
      language: 'en-US',
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z',
    }))
    expect(document.assets.style.lock).toEqual({ locked: false, lockReason: '' })
  })

  it('parses automated novel extraction assets and fills optional production defaults', () => {
    const parsed = parseProductionPrepDocument(validDocument())

    expect(parsed.sourceMode).toBe('novel')
    expect(parsed.bible.genres).toEqual([])
    expect(parsed.assets.characters[0]).toEqual(expect.objectContaining({
      id: 'char.lead',
      aliases: [],
      continuityNotes: [],
      lock: { locked: false, lockReason: '' },
    }))
    expect(parsed.sceneBreakdowns[0].productionElements).toEqual({
      castCharacterIds: [],
      extras: [],
      props: [],
      setDressing: [],
      costumes: [],
      makeup: [],
      vfx: [],
      sound: [],
      music: [],
      specialEquipment: [],
    })
  })

  it('rejects unknown fields instead of silently dropping them', () => {
    expect(() => parseProductionPrepDocument({
      ...validDocument(),
      providerSecret: 'never persist this',
    })).toThrow('Unrecognized key')
  })

  it('validates duration ranges, duplicate ids, and cross references', () => {
    const result = validateProductionPrepDocument({
      ...validDocument(),
      assets: {
        characters: [
          { id: 'char.lead', name: 'Lin' },
          { id: 'char.lead', name: 'Lin clone' },
        ],
        locations: [],
        props: [],
      },
      episodePlans: [
        {
          id: 'ep.1',
          episodeNumber: 1,
          title: 'Bad range',
          targetDurationSeconds: 900,
          minDurationSeconds: 1200,
        },
      ],
      sceneBreakdowns: [
        {
          id: 'scene.1',
          episodeId: 'ep.404',
          sceneNumber: 1,
          title: 'Missing refs',
          setting: 'Unknown',
          estimatedDurationSeconds: 100,
          characterIds: ['char.404'],
          locationIds: ['loc.404'],
          propIds: ['prop.404'],
        },
      ],
      shotPlans: [
        {
          id: 'shot.1',
          sceneId: 'scene.404',
          shotNumber: 1,
          description: 'Missing scene',
          durationSeconds: 3,
          characterIds: ['char.404'],
          locationIds: ['loc.404'],
          propIds: ['prop.404'],
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'DUPLICATE_ID',
      'INVALID_DURATION_RANGE',
      'UNKNOWN_EPISODE_REFERENCE',
      'UNKNOWN_SCENE_REFERENCE',
      'UNKNOWN_CHARACTER_REFERENCE',
      'UNKNOWN_LOCATION_REFERENCE',
      'UNKNOWN_PROP_REFERENCE',
    ]))
  })
})
