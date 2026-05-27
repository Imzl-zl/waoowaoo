import {
  parseProductionPrepDocument,
  type CharacterCard,
  type LocationCard,
  type ProductionPrepDocument,
  type PropCard,
} from '@/lib/production-bible'

type AssetKind = 'characters' | 'locations' | 'props'
type AssetCard = CharacterCard | LocationCard | PropCard

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

function nextAssetId(kind: AssetKind, items: readonly AssetCard[], name: string): string {
  const prefix = kind === 'characters' ? 'char' : kind === 'locations' ? 'loc' : 'prop'
  const base = slug(name) || `${prefix}.${items.length + 1}`
  const candidate = base.startsWith(`${prefix}.`) ? base : `${prefix}.${base}`
  const used = new Set(items.map((item) => item.id))
  if (!used.has(candidate)) return candidate
  let index = items.length + 1
  while (used.has(`${candidate}.${index}`)) index += 1
  return `${candidate}.${index}`
}

function emptyAsset(kind: AssetKind, name: string, items: readonly AssetCard[]): AssetCard {
  const id = nextAssetId(kind, items, name)
  const base = { id, name: name.trim() || id, continuityNotes: [], lock: { locked: false, lockReason: '' } }
  if (kind === 'characters') {
    return {
      ...base,
      aliases: [],
      role: '',
      biography: '',
      personality: '',
      goals: [],
      relationships: {},
      appearance: '',
      wardrobe: '',
      voice: '',
    } satisfies CharacterCard
  }
  if (kind === 'locations') {
    return {
      ...base,
      summary: '',
      geography: '',
      atmosphere: '',
      timePeriod: '',
      visualAnchors: [],
      practicalNotes: [],
    } satisfies LocationCard
  }
  return {
    ...base,
    summary: '',
    ownerCharacterIds: [],
    visualAnchors: [],
    storyFunction: '',
  } satisfies PropCard
}

export function parseProductionPrepJsonDraft(value: string): ProductionPrepDocument {
  return parseProductionPrepDocument(JSON.parse(value))
}

export function formatProductionPrepJson(document: ProductionPrepDocument): string {
  return JSON.stringify(document, null, 2)
}

export function updateAssetName(
  document: ProductionPrepDocument,
  kind: AssetKind,
  id: string,
  name: string,
): ProductionPrepDocument {
  return {
    ...document,
    assets: {
      ...document.assets,
      [kind]: document.assets[kind].map((item) => (
        item.id === id ? { ...item, name } : item
      )),
    },
  }
}

export function updateAssetLock(
  document: ProductionPrepDocument,
  kind: AssetKind,
  id: string,
  locked: boolean,
): ProductionPrepDocument {
  return {
    ...document,
    assets: {
      ...document.assets,
      [kind]: document.assets[kind].map((item) => (
        item.id === id
          ? { ...item, lock: { ...item.lock, locked } }
          : item
      )),
    },
  }
}

export function addProductionPrepAsset(
  document: ProductionPrepDocument,
  kind: AssetKind,
  name: string,
): ProductionPrepDocument {
  const items = document.assets[kind]
  return {
    ...document,
    assets: {
      ...document.assets,
      [kind]: [...items, emptyAsset(kind, name, items)],
    },
  }
}

export function removeProductionPrepAsset(
  document: ProductionPrepDocument,
  kind: AssetKind,
  id: string,
): ProductionPrepDocument {
  return {
    ...document,
    assets: {
      ...document.assets,
      [kind]: document.assets[kind].filter((item) => item.id !== id),
    },
  }
}

export function toggleStyleLock(document: ProductionPrepDocument, locked: boolean): ProductionPrepDocument {
  return {
    ...document,
    assets: {
      ...document.assets,
      style: {
        ...document.assets.style,
        lock: { ...document.assets.style.lock, locked },
      },
    },
  }
}

export function toggleContinuityLock(document: ProductionPrepDocument, locked: boolean): ProductionPrepDocument {
  return {
    ...document,
    continuity: {
      ...document.continuity,
      lock: { ...document.continuity.lock, locked },
    },
  }
}
