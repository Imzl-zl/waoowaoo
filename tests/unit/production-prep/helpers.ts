import { parseProductionPrepDocument, type ProductionPrepDocument } from '@/lib/production-bible'

export function productionPrepDocument(overrides: Partial<ProductionPrepDocument> = {}): ProductionPrepDocument {
  return parseProductionPrepDocument({
    schemaVersion: 1,
    sourceMode: 'manual',
    title: 'River Case',
    bible: {
      logline: 'A detective follows a missing heir.',
      synopsis: 'A missing heir case uncovers a flood-city conspiracy.',
    },
    assets: {
      characters: [
        {
          id: 'char.lin',
          name: 'Lin',
          biography: 'A careful detective.',
        },
      ],
      locations: [
        {
          id: 'loc.river',
          name: 'River Market',
          summary: 'A crowded night market by the river.',
        },
      ],
      props: [
        {
          id: 'prop.letter',
          name: 'Wet Letter',
          summary: 'The first clue.',
        },
      ],
      style: {
        visualStyle: 'grounded noir',
      },
    },
    continuity: {
      globalRules: ['Rain never stops in act one.'],
    },
    metadata: {
      language: 'en',
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z',
    },
    ...overrides,
  })
}
