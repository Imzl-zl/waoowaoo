'use client'

import { useState } from 'react'
import { AppIcon } from '@/components/ui/icons'
import type {
  CharacterCard,
  LocationCard,
  ProductionPrepDocument,
  PropCard,
} from '@/lib/production-bible'
import {
  addProductionPrepAsset,
  removeProductionPrepAsset,
  updateAssetLock,
  updateAssetName,
} from './productionPrepEditor'

type AssetKind = 'characters' | 'locations' | 'props'
type AssetCard = CharacterCard | LocationCard | PropCard

type Props = {
  document: ProductionPrepDocument
  kind: AssetKind
  title: string
  addLabel: string
  emptyLabel: string
  onChange: (document: ProductionPrepDocument) => void
  t: (key: string, values?: Record<string, string | number>) => string
}

function summaryFor(item: AssetCard): string {
  if ('biography' in item && item.biography) return item.biography
  if ('summary' in item && item.summary) return item.summary
  if ('storyFunction' in item && item.storyFunction) return item.storyFunction
  return item.continuityNotes.join(' · ')
}

export default function ProductionPrepAssetList({
  document,
  kind,
  title,
  addLabel,
  emptyLabel,
  onChange,
  t,
}: Props) {
  const [newName, setNewName] = useState('')
  const items = document.assets[kind]

  function addAsset() {
    if (!newName.trim()) return
    onChange(addProductionPrepAsset(document, kind, newName))
    setNewName('')
  }

  return (
    <section className="glass-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-[var(--glass-text-primary)]">{title}</h2>
        <span className="glass-chip glass-chip-info">{items.length}</span>
      </div>
      <div className="mb-3 flex gap-2">
        <input
          className="glass-input-base min-w-0 flex-1 px-3 py-2 text-sm"
          value={newName}
          placeholder={addLabel}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') addAsset()
          }}
        />
        <button
          type="button"
          className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-2 text-sm"
          onClick={addAsset}
          disabled={!newName.trim()}
        >
          <AppIcon name="plus" className="h-4 w-4" />
          {t('add')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--glass-stroke-base)] px-3 py-6 text-center text-sm text-[var(--glass-text-tertiary)]">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] p-3">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  className={`glass-btn-base rounded-lg p-2 ${item.lock.locked ? 'glass-btn-tone-warning' : 'glass-btn-soft'}`}
                  title={item.lock.locked ? t('unlock') : t('lock')}
                  onClick={() => onChange(updateAssetLock(document, kind, item.id, !item.lock.locked))}
                >
                  <AppIcon name="lock" className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <input
                    className="glass-input-base w-full px-3 py-2 text-sm font-semibold"
                    value={item.name}
                    onChange={(event) => onChange(updateAssetName(document, kind, item.id, event.target.value))}
                  />
                  <div className="mt-1 truncate font-mono text-[11px] text-[var(--glass-text-tertiary)]">
                    {item.id}
                  </div>
                  {summaryFor(item) ? (
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--glass-text-secondary)]">
                      {summaryFor(item)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="glass-btn-base glass-btn-ghost rounded-lg p-2 text-[var(--glass-tone-danger-fg)]"
                  title={t('remove')}
                  onClick={() => onChange(removeProductionPrepAsset(document, kind, item.id))}
                >
                  <AppIcon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
