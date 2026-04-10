'use client'

import { GlassModalShell } from '@/components/ui/primitives'
import { AppIcon } from '@/components/ui/icons'

export type TestStepStatus = 'pass' | 'fail' | 'skip'

export interface TestStep {
  name: string
  status: TestStepStatus
  message: string
  model?: string
  detail?: string
}

export type TestStatus = 'idle' | 'testing' | 'passed' | 'failed'

export type CustomProviderType = 'gemini-compatible' | 'openai-compatible'

export interface NewCustomProviderDraft {
  name: string
  baseUrl: string
  apiKey: string
  apiType: CustomProviderType
}

interface AddCustomProviderModalProps {
  open: boolean
  draft: NewCustomProviderDraft
  testStatus: TestStatus
  testSteps: TestStep[]
  onClose: () => void
  onSubmit: () => void
  onForceAdd: () => void
  onChange: (updates: Partial<NewCustomProviderDraft>) => void
  t: (key: string) => string
  tc: (key: string) => string
  tp: (key: string) => string
}

export function AddCustomProviderModal({
  open,
  draft,
  testStatus,
  testSteps,
  onClose,
  onSubmit,
  onForceAdd,
  onChange,
  t,
  tc,
  tp,
}: AddCustomProviderModalProps) {
  return (
    <GlassModalShell
      open={open}
      onClose={onClose}
      title={t('addGeminiProvider')}
      description={t('providerPool')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="glass-btn-base glass-btn-secondary px-3 py-1.5 text-sm"
          >
            {tc('cancel')}
          </button>
          {testStatus === 'failed' && (
            <button
              onClick={onForceAdd}
              className="glass-btn-base glass-btn-secondary px-3 py-1.5 text-sm"
            >
              {t('addAnyway')}
            </button>
          )}
          {testStatus === 'failed' ? (
            <button
              onClick={onSubmit}
              className="glass-btn-base glass-btn-primary px-3 py-1.5 text-sm"
            >
              {t('testRetry')}
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={testStatus === 'testing'}
              className="glass-btn-base glass-btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {testStatus === 'testing' ? t('testing') : tp('add')}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <AppIcon name="alert" className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="text-[12px] leading-relaxed">{t('customProviderTip')}</span>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--glass-text-primary)]">
            {t('apiType')}
          </label>
          <div className="relative">
            <select
              value={draft.apiType}
              onChange={(event) =>
                onChange({ apiType: event.target.value as CustomProviderType })}
              disabled={testStatus === 'testing'}
              className="glass-select-base w-full cursor-pointer appearance-none px-3 py-2.5 pr-8 text-sm"
            >
              <option value="gemini-compatible">{t('apiTypeGeminiCompatible')}</option>
              <option value="openai-compatible">{t('apiTypeOpenAICompatible')}</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-3 text-[var(--glass-text-tertiary)]">
              <AppIcon name="chevronDown" className="w-3 h-3" />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--glass-text-primary)]">
            {tp('name')}
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            disabled={testStatus === 'testing'}
            placeholder={tp('name')}
            className="glass-input-base w-full px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--glass-text-primary)]">
            {t('baseUrl')}
          </label>
          <input
            type="text"
            value={draft.baseUrl}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
            disabled={testStatus === 'testing'}
            placeholder={t('baseUrl')}
            className="glass-input-base w-full px-3 py-2.5 text-sm font-mono"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--glass-text-primary)]">
            {t('apiKeyLabel')}
          </label>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(event) => onChange({ apiKey: event.target.value })}
            disabled={testStatus === 'testing'}
            placeholder={t('apiKeyLabel')}
            className="glass-input-base w-full px-3 py-2.5 text-sm"
          />
        </div>

        {testStatus !== 'idle' && (
          <div className="space-y-2 rounded-xl border border-[var(--glass-border)] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--glass-text-primary)]">
              <AppIcon name="settingsHex" className="h-3.5 w-3.5" />
              {t('testConnection')}
            </div>

            {testStatus === 'testing' && testSteps.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-[var(--glass-text-secondary)]">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('testing')}
              </div>
            )}

            {testSteps.map((step) => (
              <div key={step.name} className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs">
                  {step.status === 'pass' && (
                    <span className="text-green-500">
                      <AppIcon name="check" className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {step.status === 'fail' && (
                    <span className="text-red-500">
                      <AppIcon name="close" className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {step.status === 'skip' && (
                    <span className="text-[var(--glass-text-tertiary)]">–</span>
                  )}
                  <span className="font-medium text-[var(--glass-text-primary)]">
                    {t(`testStep.${step.name}`)}
                  </span>
                  {step.model && (
                    <span className="rounded bg-[var(--glass-bg-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--glass-text-secondary)]">
                      {step.model}
                    </span>
                  )}
                </div>
                <p
                  className={`pl-5 text-[11px] ${
                    step.status === 'fail'
                      ? 'text-red-400'
                      : 'text-[var(--glass-text-secondary)]'
                  }`}
                >
                  {step.message}
                </p>
                {step.detail && (
                  <p className="pl-5 text-[10px] text-[var(--glass-text-tertiary)] break-all line-clamp-3">
                    {step.detail}
                  </p>
                )}
              </div>
            ))}

            {testStatus === 'failed' && (
              <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 px-2.5 py-2 text-[11px] text-yellow-600 dark:text-yellow-400">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{t('testWarning')}</span>
              </div>
            )}

            {testStatus === 'passed' && (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-2.5 py-2 text-[11px] text-green-600 dark:text-green-400">
                <AppIcon name="check" className="h-3.5 w-3.5" />
                {t('testPassed')}
              </div>
            )}
          </div>
        )}
      </div>
    </GlassModalShell>
  )
}
