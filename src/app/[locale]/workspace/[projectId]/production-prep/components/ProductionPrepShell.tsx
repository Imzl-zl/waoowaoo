'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import {
  useExtractProjectProductionPrep,
  usePlanProjectProductionPrepEpisodes,
  useProjectProductionPrep,
  useSaveProjectProductionPrep,
} from '@/lib/query/hooks'
import type { ProductionPrepDocument, ProductionSourceMode } from '@/lib/production-bible'
import ProductionPrepAssetList from './ProductionPrepAssetList'
import {
  formatProductionPrepJson,
  parseProductionPrepJsonDraft,
  toggleContinuityLock,
  toggleStyleLock,
} from './productionPrepEditor'

type Props = {
  projectId: string
  projectName: string
}

type Pacing = 'slow' | 'balanced' | 'fast'

function lines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

function text(value: readonly string[]): string {
  return value.join('\n')
}

function statusFromConflicts(count: number, t: (key: string, values?: Record<string, number>) => string): string {
  return count > 0 ? t('savedWithConflicts', { count }) : t('saved')
}

export default function ProductionPrepShell({ projectId, projectName }: Props) {
  const t = useTranslations('productionPrep')
  const locale = useLocale()
  const prepQuery = useProjectProductionPrep(projectId)
  const savePrep = useSaveProjectProductionPrep(projectId)
  const extractPrep = useExtractProjectProductionPrep(projectId)
  const planEpisodes = usePlanProjectProductionPrepEpisodes(projectId)
  const [document, setDocument] = useState<ProductionPrepDocument | null>(null)
  const [jsonDraft, setJsonDraft] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [sourceMode, setSourceMode] = useState<ProductionSourceMode>('manual')
  const [extractInstruction, setExtractInstruction] = useState('')
  const [episodeCount, setEpisodeCount] = useState(6)
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(900)
  const [minDurationSeconds, setMinDurationSeconds] = useState(780)
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(1020)
  const [pacing, setPacing] = useState<Pacing>('balanced')
  const [planInstruction, setPlanInstruction] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [conflictCount, setConflictCount] = useState(0)
  const isBusy = savePrep.isPending || extractPrep.isPending || planEpisodes.isPending

  useEffect(() => {
    const remote = prepQuery.data?.document
    if (!remote) return
    setDocument(remote)
    setJsonDraft(formatProductionPrepJson(remote))
    setSourceMode(remote.sourceMode)
    setStatusMessage('')
    setJsonError('')
    setConflictCount(0)
  }, [prepQuery.data?.document])

  const validationIssues = prepQuery.data?.validation.issues || []
  const episodePlans = document?.episodePlans || []
  const updatedAt = prepQuery.data?.updatedAt || document?.metadata.updatedAt || ''

  function updateDocument(next: ProductionPrepDocument) {
    setDocument(next)
    setJsonDraft(formatProductionPrepJson(next))
    setJsonError('')
    setStatusMessage('')
  }

  function patchDocument(patch: Partial<ProductionPrepDocument>) {
    if (!document) return
    updateDocument({ ...document, ...patch })
  }

  async function handleSave() {
    if (!document) return
    const result = await savePrep.mutateAsync(document)
    updateDocument(result.productionPrep.document)
    setConflictCount(result.conflicts.length)
    setStatusMessage(statusFromConflicts(result.conflicts.length, t))
  }

  async function handleApplyJson() {
    try {
      updateDocument(parseProductionPrepJsonDraft(jsonDraft))
      setStatusMessage(t('jsonApplied'))
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : t('jsonInvalid'))
    }
  }

  async function handleExtract() {
    if (!sourceText.trim()) {
      setStatusMessage(t('sourceRequired'))
      return
    }
    const result = await extractPrep.mutateAsync({
      sourceText,
      sourceMode,
      title: document?.title || projectName,
      instruction: extractInstruction,
      language: locale === 'zh' ? 'zh-CN' : 'en',
    })
    updateDocument(result.productionPrep.document)
    setConflictCount(result.conflicts.length)
    setStatusMessage(statusFromConflicts(result.conflicts.length, t))
  }

  async function handlePlanEpisodes() {
    if (!document) return
    await savePrep.mutateAsync(document)
    const result = await planEpisodes.mutateAsync({
      episodeCount,
      targetDurationSeconds,
      minDurationSeconds,
      maxDurationSeconds,
      pacing,
      instruction: planInstruction,
      language: locale === 'zh' ? 'zh-CN' : 'en',
    })
    updateDocument(result.productionPrep.document)
    setConflictCount(result.conflicts.length)
    setStatusMessage(t('episodesPlanned', { count: result.productionPrep.document.episodePlans.length }))
  }

  const sourceModeOptions = useMemo(() => [
    { value: 'manual' as const, label: t('manualMode') },
    { value: 'novel' as const, label: t('novelMode') },
  ], [t])

  if (prepQuery.error) {
    return (
      <div className="glass-surface border-[var(--glass-stroke-danger)] p-6 text-sm text-[var(--glass-tone-danger-fg)]">
        {t('loadFailed')}
      </div>
    )
  }

  if (prepQuery.isLoading || !document) {
    return <div className="glass-surface p-6 text-sm text-[var(--glass-text-secondary)]">{t('loading')}</div>
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="glass-surface p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <input
                className="glass-input-base w-full px-3 py-2 text-lg font-bold"
                value={document.title}
                onChange={(event) => patchDocument({ title: event.target.value })}
              />
              <div className="mt-1 text-xs font-semibold text-[var(--glass-text-tertiary)]">
                {t('version', { version: prepQuery.data?.version || 0 })}{updatedAt ? ` · ${updatedAt}` : ''}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-2 text-sm"
                disabled={isBusy}
                onClick={() => void handleApplyJson()}
              >
                <AppIcon name="code" className="h-4 w-4" />
                {t('applyJson')}
              </button>
              <button
                type="button"
                className="glass-btn-base glass-btn-primary rounded-lg px-3 py-2 text-sm"
                disabled={isBusy}
                onClick={() => void handleSave()}
              >
                <AppIcon name={savePrep.isPending ? 'loader' : 'cloudUpload'} className={`h-4 w-4 ${savePrep.isPending ? 'animate-spin' : ''}`} />
                {savePrep.isPending ? t('saving') : t('save')}
              </button>
            </div>
          </div>
          {statusMessage ? <div className="mb-3 text-sm font-semibold text-[var(--glass-tone-info-fg)]">{statusMessage}</div> : null}
          {jsonError ? <div className="mb-3 text-sm font-semibold text-[var(--glass-tone-danger-fg)]">{jsonError}</div> : null}
          {conflictCount > 0 ? (
            <div className="mb-3 rounded-lg border border-[var(--glass-stroke-warning)] bg-[var(--glass-tone-warning-bg)] px-3 py-2 text-sm text-[var(--glass-tone-warning-fg)]">
              {t('conflictSummary', { count: conflictCount })}
            </div>
          ) : null}
        </section>

        <section className="glass-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-[var(--glass-text-primary)]">{t('bible')}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5 md:col-span-2">
              <span className="glass-field-label">{t('logline')}</span>
              <input
                className="glass-input-base w-full px-3 py-2 text-sm"
                value={document.bible.logline}
                onChange={(event) => updateDocument({ ...document, bible: { ...document.bible, logline: event.target.value } })}
              />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="glass-field-label">{t('synopsis')}</span>
              <textarea
                className="glass-input-base min-h-28 w-full resize-y px-3 py-2 text-sm"
                value={document.bible.synopsis}
                onChange={(event) => updateDocument({ ...document, bible: { ...document.bible, synopsis: event.target.value } })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="glass-field-label">{t('genres')}</span>
              <textarea
                className="glass-input-base min-h-24 w-full resize-y px-3 py-2 text-sm"
                value={text(document.bible.genres)}
                onChange={(event) => updateDocument({ ...document, bible: { ...document.bible, genres: lines(event.target.value) } })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="glass-field-label">{t('themes')}</span>
              <textarea
                className="glass-input-base min-h-24 w-full resize-y px-3 py-2 text-sm"
                value={text(document.bible.themes)}
                onChange={(event) => updateDocument({ ...document, bible: { ...document.bible, themes: lines(event.target.value) } })}
              />
            </label>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <ProductionPrepAssetList
            document={document}
            kind="characters"
            title={t('characters')}
            addLabel={t('addCharacter')}
            emptyLabel={t('emptyCharacters')}
            onChange={updateDocument}
            t={t}
          />
          <ProductionPrepAssetList
            document={document}
            kind="locations"
            title={t('locations')}
            addLabel={t('addLocation')}
            emptyLabel={t('emptyLocations')}
            onChange={updateDocument}
            t={t}
          />
          <ProductionPrepAssetList
            document={document}
            kind="props"
            title={t('props')}
            addLabel={t('addProp')}
            emptyLabel={t('emptyProps')}
            onChange={updateDocument}
            t={t}
          />
        </div>

        <section className="glass-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[var(--glass-text-primary)]">{t('styleAndContinuity')}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className={`glass-btn-base rounded-lg px-3 py-2 text-xs ${document.assets.style.lock.locked ? 'glass-btn-tone-warning' : 'glass-btn-soft'}`}
                onClick={() => updateDocument(toggleStyleLock(document, !document.assets.style.lock.locked))}
              >
                <AppIcon name="lock" className="h-4 w-4" />
                {t('styleLock')}
              </button>
              <button
                type="button"
                className={`glass-btn-base rounded-lg px-3 py-2 text-xs ${document.continuity.lock.locked ? 'glass-btn-tone-warning' : 'glass-btn-soft'}`}
                onClick={() => updateDocument(toggleContinuityLock(document, !document.continuity.lock.locked))}
              >
                <AppIcon name="lock" className="h-4 w-4" />
                {t('continuityLock')}
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="glass-field-label">{t('visualStyle')}</span>
              <textarea
                className="glass-input-base min-h-24 w-full resize-y px-3 py-2 text-sm"
                value={document.assets.style.visualStyle}
                onChange={(event) => updateDocument({ ...document, assets: { ...document.assets, style: { ...document.assets.style, visualStyle: event.target.value } } })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="glass-field-label">{t('globalRules')}</span>
              <textarea
                className="glass-input-base min-h-24 w-full resize-y px-3 py-2 text-sm"
                value={text(document.continuity.globalRules)}
                onChange={(event) => updateDocument({ ...document, continuity: { ...document.continuity, globalRules: lines(event.target.value) } })}
              />
            </label>
          </div>
        </section>

        <section className="glass-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-[var(--glass-text-primary)]">{t('episodePlans')}</h2>
          {episodePlans.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--glass-stroke-base)] px-3 py-6 text-center text-sm text-[var(--glass-text-tertiary)]">
              {t('emptyEpisodePlans')}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {episodePlans.map((episode) => (
                <article key={episode.id} className="rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] p-3">
                  <div className="mb-1 text-sm font-bold text-[var(--glass-text-primary)]">
                    {episode.episodeNumber}. {episode.title}
                  </div>
                  <p className="line-clamp-3 text-xs text-[var(--glass-text-secondary)]">{episode.summary}</p>
                  <div className="mt-2 text-[11px] font-semibold text-[var(--glass-text-tertiary)]">
                    {t('episodeDuration', {
                      seconds: episode.targetDurationSeconds,
                      pacing: episode.pacing,
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="glass-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-[var(--glass-text-primary)]">{t('jsonEditor')}</h2>
          <textarea
            className="glass-input-base min-h-[360px] w-full resize-y px-3 py-2 font-mono text-xs"
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            spellCheck={false}
          />
        </section>
      </div>

      <aside className="space-y-4">
        <section className="glass-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--glass-text-primary)]">
            <AppIcon name="sparkles" className="h-4 w-4 text-[var(--glass-tone-info-fg)]" />
            {t('extractTitle')}
          </h2>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {sourceModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`glass-btn-base rounded-lg px-3 py-2 text-sm ${sourceMode === option.value ? 'glass-btn-primary' : 'glass-btn-soft'}`}
                onClick={() => setSourceMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <textarea
            className="glass-input-base mb-3 min-h-48 w-full resize-y px-3 py-2 text-sm"
            value={sourceText}
            placeholder={t('sourcePlaceholder')}
            onChange={(event) => setSourceText(event.target.value)}
          />
          <textarea
            className="glass-input-base mb-3 min-h-20 w-full resize-y px-3 py-2 text-sm"
            value={extractInstruction}
            placeholder={t('instructionPlaceholder')}
            onChange={(event) => setExtractInstruction(event.target.value)}
          />
          <button
            type="button"
            className="glass-btn-base glass-btn-primary w-full rounded-lg px-3 py-2 text-sm"
            disabled={isBusy}
            onClick={() => void handleExtract()}
          >
            <AppIcon name={extractPrep.isPending ? 'loader' : 'wandOff'} className={`h-4 w-4 ${extractPrep.isPending ? 'animate-spin' : ''}`} />
            {extractPrep.isPending ? t('extracting') : t('extract')}
          </button>
        </section>

        <section className="glass-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--glass-text-primary)]">
            <AppIcon name="barChart" className="h-4 w-4 text-[var(--glass-tone-info-fg)]" />
            {t('planningTitle')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="glass-field-label">{t('episodeCount')}</span>
              <input className="glass-input-base w-full px-3 py-2 text-sm" type="number" min={1} value={episodeCount} onChange={(event) => setEpisodeCount(Number(event.target.value))} />
            </label>
            <label className="space-y-1.5">
              <span className="glass-field-label">{t('targetDuration')}</span>
              <input className="glass-input-base w-full px-3 py-2 text-sm" type="number" min={60} value={targetDurationSeconds} onChange={(event) => setTargetDurationSeconds(Number(event.target.value))} />
            </label>
            <label className="space-y-1.5">
              <span className="glass-field-label">{t('minDuration')}</span>
              <input className="glass-input-base w-full px-3 py-2 text-sm" type="number" min={60} value={minDurationSeconds} onChange={(event) => setMinDurationSeconds(Number(event.target.value))} />
            </label>
            <label className="space-y-1.5">
              <span className="glass-field-label">{t('maxDuration')}</span>
              <input className="glass-input-base w-full px-3 py-2 text-sm" type="number" min={60} value={maxDurationSeconds} onChange={(event) => setMaxDurationSeconds(Number(event.target.value))} />
            </label>
          </div>
          <select
            className="glass-input-base mt-3 w-full px-3 py-2 text-sm"
            value={pacing}
            onChange={(event) => setPacing(event.target.value as Pacing)}
          >
            <option value="slow">{t('pacingSlow')}</option>
            <option value="balanced">{t('pacingBalanced')}</option>
            <option value="fast">{t('pacingFast')}</option>
          </select>
          <textarea
            className="glass-input-base mt-3 min-h-20 w-full resize-y px-3 py-2 text-sm"
            value={planInstruction}
            placeholder={t('planningInstructionPlaceholder')}
            onChange={(event) => setPlanInstruction(event.target.value)}
          />
          <button
            type="button"
            className="glass-btn-base glass-btn-primary mt-3 w-full rounded-lg px-3 py-2 text-sm"
            disabled={isBusy}
            onClick={() => void handlePlanEpisodes()}
          >
            <AppIcon name={planEpisodes.isPending ? 'loader' : 'clipboardCheck'} className={`h-4 w-4 ${planEpisodes.isPending ? 'animate-spin' : ''}`} />
            {planEpisodes.isPending ? t('planning') : t('planEpisodes')}
          </button>
        </section>

        {validationIssues.length > 0 ? (
          <section className="glass-surface border-[var(--glass-stroke-warning)] p-4">
            <h2 className="mb-2 text-sm font-bold text-[var(--glass-tone-warning-fg)]">{t('validationIssues')}</h2>
            <div className="space-y-2">
              {validationIssues.slice(0, 6).map((issue) => (
                <div key={`${issue.path}:${issue.message}`} className="rounded-lg bg-[var(--glass-bg-muted)] px-3 py-2 text-xs text-[var(--glass-text-secondary)]">
                  <span className="font-mono">{issue.path || t('validationRoot')}</span>: {issue.message}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  )
}
