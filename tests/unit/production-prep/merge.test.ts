import { describe, expect, it } from 'vitest'
import {
  mergeGeneratedEpisodePlans,
  mergeGeneratedProductionPrepDocument,
} from '@/lib/production-prep'
import { productionPrepDocument } from './helpers'

describe('production prep merge policy', () => {
  it('preserves locked asset cards and reports explicit conflicts', () => {
    const current = productionPrepDocument({
      assets: {
        ...productionPrepDocument().assets,
        characters: [
          {
            ...productionPrepDocument().assets.characters[0],
            name: 'Locked Lin',
            biography: 'Approved biography.',
            lock: { locked: true, lockReason: 'approved' },
          },
        ],
      },
    })
    const generated = productionPrepDocument({
      assets: {
        ...current.assets,
        characters: [
          {
            ...current.assets.characters[0],
            name: 'Generated Lin',
            biography: 'Generated overwrite.',
            lock: { locked: false, lockReason: '' },
          },
          {
            id: 'char.mei',
            name: 'Mei',
            aliases: [],
            role: '',
            biography: '',
            personality: '',
            goals: [],
            relationships: {},
            appearance: '',
            wardrobe: '',
            voice: '',
            continuityNotes: [],
            lock: { locked: false, lockReason: '' },
          },
        ],
      },
    })

    const result = mergeGeneratedProductionPrepDocument({
      current,
      generated,
      now: '2026-05-27T01:00:00.000Z',
    })

    expect(result.document.assets.characters).toEqual([
      expect.objectContaining({
        id: 'char.lin',
        name: 'Locked Lin',
        biography: 'Approved biography.',
        lock: { locked: true, lockReason: 'approved' },
      }),
      expect.objectContaining({ id: 'char.mei', name: 'Mei' }),
    ])
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        section: 'characters',
        path: 'assets.characters.char.lin',
        id: 'char.lin',
      }),
    ])
  })

  it('preserves locked style and continuity rules during generated updates', () => {
    const current = productionPrepDocument({
      assets: {
        ...productionPrepDocument().assets,
        style: {
          ...productionPrepDocument().assets.style,
          visualStyle: 'approved style',
          lock: { locked: true, lockReason: '' },
        },
      },
      continuity: {
        ...productionPrepDocument().continuity,
        globalRules: ['approved continuity'],
        lock: { locked: true, lockReason: '' },
      },
    })
    const generated = productionPrepDocument({
      assets: {
        ...current.assets,
        style: {
          ...current.assets.style,
          visualStyle: 'generated style',
          lock: { locked: false, lockReason: '' },
        },
      },
      continuity: {
        ...current.continuity,
        globalRules: ['generated continuity'],
        lock: { locked: false, lockReason: '' },
      },
    })

    const result = mergeGeneratedProductionPrepDocument({
      current,
      generated,
      now: '2026-05-27T01:00:00.000Z',
    })

    expect(result.document.assets.style.visualStyle).toBe('approved style')
    expect(result.document.continuity.globalRules).toEqual(['approved continuity'])
    expect(result.conflicts.map((item) => item.section)).toEqual(['style', 'continuity'])
  })

  it('updates episode plans without mutating approved assets', () => {
    const current = productionPrepDocument()
    const next = mergeGeneratedEpisodePlans({
      current,
      now: '2026-05-27T02:00:00.000Z',
      episodePlans: [
        {
          id: 'ep.1',
          episodeNumber: 1,
          title: 'The Letter',
          summary: 'The case begins.',
          targetDurationSeconds: 900,
          pacing: 'balanced',
          beats: ['Letter arrives'],
          cliffhanger: '',
          continuityFocus: ['Rain'],
        },
      ],
    })

    expect(next.assets).toBe(current.assets)
    expect(next.episodePlans).toHaveLength(1)
    expect(next.metadata.updatedAt).toBe('2026-05-27T02:00:00.000Z')
  })
})
