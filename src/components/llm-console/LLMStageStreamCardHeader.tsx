'use client'

import type { ReactNode } from 'react'

interface LLMStageStreamCardHeaderProps {
  title: string
  subtitle?: string
  activeStageTitle?: string
  activeMessage?: string
  currentStep: number
  stageCount: number
  normalizedOverallProgress: number
  errorMessage?: string
  topRightAction?: ReactNode
  resolveProgressText: (value: string | undefined, fallbackKey: string) => string
  t: (key: string, values?: Record<string, string | number | Date>) => string
}

export function LLMStageStreamCardHeader({
  title,
  subtitle,
  activeStageTitle,
  activeMessage,
  currentStep,
  stageCount,
  normalizedOverallProgress,
  errorMessage,
  topRightAction,
  resolveProgressText,
  t,
}: LLMStageStreamCardHeaderProps) {
  return (
    <header className="border-b border-[var(--glass-stroke-base)] px-5 py-5 md:px-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[15rem_minmax(0,1fr)_auto] md:items-center">
        <div className="glass-surface-soft rounded-xl border border-[var(--glass-stroke-base)] p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--glass-text-tertiary)]">
            {t('stageCard.stage')}
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--glass-text-primary)]">
            {currentStep}/{stageCount}
          </p>
          <p className="mt-1 truncate text-sm text-[var(--glass-text-secondary)]">
            {resolveProgressText(activeStageTitle, 'stageCard.currentStage')}
          </p>
        </div>

        <div className="min-w-0 text-center">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--glass-text-tertiary)]">
            {resolveProgressText(subtitle, 'stageCard.realtimeStream')}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--glass-text-primary)] md:text-2xl">
            {resolveProgressText(title, 'stageCard.currentStage')}
          </h2>
          <p className="mt-2 truncate text-sm text-[var(--glass-text-secondary)]">
            {resolveProgressText(activeMessage, 'runtime.llm.processing')}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-start whitespace-nowrap md:justify-end">
          {topRightAction || null}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--glass-bg-muted)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(120deg,var(--glass-accent-from),var(--glass-accent-to))] transition-[width] duration-200"
          style={{ width: `${Math.max(normalizedOverallProgress, 2)}%` }}
        />
      </div>

      {errorMessage && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg bg-[var(--glass-tone-danger-bg)] px-4 py-2.5 text-[var(--glass-tone-danger-fg)]">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
        </div>
      )}
    </header>
  )
}
