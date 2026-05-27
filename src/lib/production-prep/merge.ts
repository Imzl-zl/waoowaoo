import type {
  CharacterCard,
  ContinuityRules,
  LocationCard,
  ProductionPrepDocument,
  PropCard,
  StyleBible,
} from '@/lib/production-bible'
import type { ProductionPrepLockConflict, ProductionPrepLockSection } from './types'

type Lockable = { lock?: { locked?: boolean } }
type LockableAsset = Lockable & { id: string; name: string }

function stableJson(value: unknown): string {
  return JSON.stringify(value)
}

function isDifferent(a: unknown, b: unknown): boolean {
  return stableJson(a) !== stableJson(b)
}

function isLocked(value: Lockable | undefined): boolean {
  return value?.lock?.locked === true
}

function conflict(params: {
  section: ProductionPrepLockSection
  path: string
  id?: string
  name?: string
}): ProductionPrepLockConflict {
  return {
    ...params,
    message: `Locked production prep item preserved at ${params.path}`,
  }
}

function mergeLockableAssets<T extends LockableAsset>(
  params: {
    section: ProductionPrepLockSection
    current: readonly T[]
    generated: readonly T[]
  },
  conflicts: ProductionPrepLockConflict[],
): T[] {
  const generatedById = new Map(params.generated.map((item) => [item.id, item]))
  const mergedById = new Map(params.generated.map((item) => [item.id, item]))

  for (const currentItem of params.current) {
    if (!isLocked(currentItem)) continue
    const generatedItem = generatedById.get(currentItem.id)
    if (generatedItem && isDifferent(currentItem, generatedItem)) {
      conflicts.push(conflict({
        section: params.section,
        path: `assets.${params.section}.${currentItem.id}`,
        id: currentItem.id,
        name: currentItem.name,
      }))
    }
    mergedById.set(currentItem.id, currentItem)
  }

  return Array.from(mergedById.values())
}

function mergeLockableObject<T extends Lockable>(
  params: {
    section: ProductionPrepLockSection
    path: string
    current: T
    generated: T
  },
  conflicts: ProductionPrepLockConflict[],
): T {
  if (!isLocked(params.current)) return params.generated
  if (isDifferent(params.current, params.generated)) {
    conflicts.push(conflict({ section: params.section, path: params.path }))
  }
  return params.current
}

export function mergeGeneratedProductionPrepDocument(params: {
  current: ProductionPrepDocument
  generated: ProductionPrepDocument
  now: string
}): { document: ProductionPrepDocument; conflicts: readonly ProductionPrepLockConflict[] } {
  const conflicts: ProductionPrepLockConflict[] = []
  return {
    conflicts,
    document: {
      ...params.generated,
      assets: {
        characters: mergeLockableAssets<CharacterCard>({
          section: 'characters',
          current: params.current.assets.characters,
          generated: params.generated.assets.characters,
        }, conflicts),
        locations: mergeLockableAssets<LocationCard>({
          section: 'locations',
          current: params.current.assets.locations,
          generated: params.generated.assets.locations,
        }, conflicts),
        props: mergeLockableAssets<PropCard>({
          section: 'props',
          current: params.current.assets.props,
          generated: params.generated.assets.props,
        }, conflicts),
        style: mergeLockableObject<StyleBible>({
          section: 'style',
          path: 'assets.style',
          current: params.current.assets.style,
          generated: params.generated.assets.style,
        }, conflicts),
      },
      continuity: mergeLockableObject<ContinuityRules>({
        section: 'continuity',
        path: 'continuity',
        current: params.current.continuity,
        generated: params.generated.continuity,
      }, conflicts),
      metadata: {
        ...params.generated.metadata,
        createdAt: params.current.metadata.createdAt || params.generated.metadata.createdAt,
        updatedAt: params.now,
      },
    },
  }
}

export function mergeGeneratedEpisodePlans(params: {
  current: ProductionPrepDocument
  episodePlans: ProductionPrepDocument['episodePlans']
  now: string
}): ProductionPrepDocument {
  return {
    ...params.current,
    episodePlans: params.episodePlans,
    metadata: {
      ...params.current.metadata,
      updatedAt: params.now,
    },
  }
}
