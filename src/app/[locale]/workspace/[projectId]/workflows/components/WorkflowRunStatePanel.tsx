'use client'

import { AppIcon } from '@/components/ui/icons'
import type { RunStepState } from '@/lib/query/hooks/run-stream/types'

type RunStatus = 'idle' | 'running' | 'completed' | 'failed'

type Props = {
  runId: string
  status: RunStatus
  activeMessage: string
  overallProgress: number
  orderedSteps: readonly RunStepState[]
  outputText: string
  errorMessage: string
  onSelectStep: (stepId: string) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

function chipClass(status: string): string {
  if (status === 'completed' || status === 'stale') return 'glass-chip glass-chip-success'
  if (status === 'failed') return 'glass-chip glass-chip-danger'
  if (status === 'running') return 'glass-chip glass-chip-info'
  if (status === 'blocked' || status === 'queued') return 'glass-chip glass-chip-warning'
  return 'glass-chip glass-chip-neutral'
}

function statusLabel(t: Props['t'], status: string): string {
  if (status === 'running') return t('runStatusRunning')
  if (status === 'completed') return t('runStatusCompleted')
  if (status === 'failed') return t('runStatusFailed')
  if (status === 'blocked') return t('runStatusBlocked')
  if (status === 'stale') return t('runStatusStale')
  return t('runStatusPending')
}

function progressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function readableMessage(value: string): string {
  return value.startsWith('progress.') ? '' : value
}

export default function WorkflowRunStatePanel({
  runId,
  status,
  activeMessage,
  overallProgress,
  orderedSteps,
  outputText,
  errorMessage,
  onSelectStep,
  t,
}: Props) {
  if (!runId) return null
  const progress = progressPercent(status === 'completed' ? 100 : overallProgress)
  const message = errorMessage || readableMessage(activeMessage)

  return (
    <section className="glass-surface px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--glass-text-primary)]">
            <AppIcon name={status === 'running' ? 'loader' : 'chart'} className={`h-4 w-4 ${status === 'running' ? 'animate-spin' : ''}`} />
            {t('runState')}
          </div>
          <div className="mt-1 truncate font-mono text-xs text-[var(--glass-text-tertiary)]">
            {runId}
          </div>
        </div>
        <span className={chipClass(status)}>{statusLabel(t, status)}</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--glass-bg-muted)]">
        <div className="h-full rounded-full bg-[var(--glass-tone-info-fg)]" style={{ width: `${progress}%` }} />
      </div>
      {message ? (
        <p className="mb-3 text-xs font-semibold text-[var(--glass-text-tertiary)]">{message}</p>
      ) : null}
      <div className="space-y-2">
        {orderedSteps.length === 0 ? (
          <div className="rounded-lg border border-[var(--glass-stroke-subtle)] px-3 py-2 text-xs font-semibold text-[var(--glass-text-tertiary)]">
            {t('runWaitingEvents')}
          </div>
        ) : orderedSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelectStep(step.id)}
            className="w-full rounded-lg border border-[var(--glass-stroke-subtle)] px-3 py-2 text-left transition hover:border-[var(--glass-stroke-strong)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[var(--glass-text-primary)]">
                  {step.stepIndex}. {step.title}
                </div>
                <div className="truncate text-xs font-semibold text-[var(--glass-text-tertiary)]">
                  {t('runStepAttempt', { attempt: step.attempt })}
                </div>
              </div>
              <span className={`${chipClass(step.status)} shrink-0 py-0.5 text-[10px]`}>
                {statusLabel(t, step.status)}
              </span>
            </div>
            {step.errorMessage ? (
              <div className="mt-2 break-words text-xs font-semibold text-[var(--glass-tone-danger-fg)]">
                {step.errorMessage}
              </div>
            ) : null}
          </button>
        ))}
      </div>
      {outputText ? (
        <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--glass-bg-muted)] p-3 text-xs text-[var(--glass-text-secondary)]">
          {outputText}
        </pre>
      ) : null}
    </section>
  )
}
