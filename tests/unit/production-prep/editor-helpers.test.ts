import { describe, expect, it } from 'vitest'
import {
  addProductionPrepAsset,
  formatProductionPrepJson,
  parseProductionPrepJsonDraft,
  removeProductionPrepAsset,
  toggleContinuityLock,
  toggleStyleLock,
  updateAssetLock,
  updateAssetName,
} from '@/app/[locale]/workspace/[projectId]/production-prep/components/productionPrepEditor'
import { productionPrepDocument } from './helpers'

describe('production prep editor helpers', () => {
  it('adds, renames, locks, and removes asset cards without mutating input', () => {
    const document = productionPrepDocument()
    const withAsset = addProductionPrepAsset(document, 'characters', 'New Lead')
    const added = withAsset.assets.characters.at(-1)

    expect(added).toEqual(expect.objectContaining({
      id: 'char.new.lead',
      name: 'New Lead',
      lock: { locked: false, lockReason: '' },
    }))
    expect(document.assets.characters).toHaveLength(1)

    const renamed = updateAssetName(withAsset, 'characters', added!.id, 'Renamed Lead')
    const locked = updateAssetLock(renamed, 'characters', added!.id, true)
    const removed = removeProductionPrepAsset(locked, 'characters', added!.id)

    expect(locked.assets.characters.at(-1)).toEqual(expect.objectContaining({
      name: 'Renamed Lead',
      lock: { locked: true, lockReason: '' },
    }))
    expect(removed.assets.characters).toHaveLength(1)
  })

  it('toggles style and continuity lock state', () => {
    const document = productionPrepDocument()
    expect(toggleStyleLock(document, true).assets.style.lock.locked).toBe(true)
    expect(toggleContinuityLock(document, true).continuity.lock.locked).toBe(true)
  })

  it('round-trips strict production prep JSON drafts', () => {
    const document = productionPrepDocument()
    const parsed = parseProductionPrepJsonDraft(formatProductionPrepJson(document))

    expect(parsed).toEqual(document)
  })
})
