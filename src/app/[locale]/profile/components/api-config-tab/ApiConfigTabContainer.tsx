'use client'

import { useState, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { resolveTaskPresentationState } from '@/lib/task/presentation'
import type { CapabilityValue } from '@/lib/model-config-contract'
import { apiFetch } from '@/lib/api-fetch'
import {
  encodeModelKey,
  getProviderDisplayName,
  parseModelKey,
  useProviders,
} from '../api-config'
import { ApiConfigToolbar } from './ApiConfigToolbar'
import { ApiConfigProviderList } from './ApiConfigProviderList'
import { DefaultModelCards } from './DefaultModelCards'
import { useApiConfigFilters } from './hooks/useApiConfigFilters'
import {
  AddCustomProviderModal,
  type CustomProviderType,
  type NewCustomProviderDraft,
  type TestStatus,
  type TestStep,
} from './AddCustomProviderModal'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isCapabilityValue(value: unknown): value is CapabilityValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function extractCapabilityFieldsFromModel(
  capabilities: Record<string, unknown> | undefined,
  modelType: string,
): Array<{ field: string; options: CapabilityValue[] }> {
  if (!capabilities) return []
  const namespace = capabilities[modelType]
  if (!isRecord(namespace)) return []
  return Object.entries(namespace)
    .filter(([key, value]) => key.endsWith('Options') && Array.isArray(value) && value.every(isCapabilityValue) && value.length > 0)
    .map(([key, value]) => ({
      field: key.slice(0, -'Options'.length),
      options: value as CapabilityValue[],
    }))
}

function parseBySample(input: string, sample: CapabilityValue): CapabilityValue {
  if (typeof sample === 'number') return Number(input)
  if (typeof sample === 'boolean') return input === 'true'
  return input
}

function toCapabilityFieldLabel(field: string): string {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

export function ApiConfigTabContainer() {
  const locale = useLocale()
  const {
    providers,
    models,
    defaultModels,
    workflowConcurrency,
    capabilityDefaults,
    loading,
    saveStatus,
    flushConfig,
    updateProviderHidden,
    updateProviderApiKey,
    updateProviderBaseUrl,
    reorderProviders,
    addProvider,
    deleteProvider,
    toggleModel,
    deleteModel,
    addModel,
    updateModel,
    updateDefaultModel,
    batchUpdateDefaultModels,
    updateWorkflowConcurrency,
    updateCapabilityDefault,
  } = useProviders()

  const t = useTranslations('apiConfig')
  const tc = useTranslations('common')
  const tp = useTranslations('providerSection')

  const savingState =
    saveStatus === 'saving'
      ? resolveTaskPresentationState({
        phase: 'processing',
        intent: 'modify',
        resource: 'text',
        hasOutput: true,
      })
      : null

  const {
    modelProviders,
    getModelsForProvider,
    getEnabledModelsByType,
  } = useApiConfigFilters({
    providers,
    models,
  })

  const [showAddGeminiProvider, setShowAddGeminiProvider] = useState(false)
  const [newGeminiProvider, setNewGeminiProvider] = useState<NewCustomProviderDraft>({
    name: '',
    baseUrl: '',
    apiKey: '',
    apiType: 'gemini-compatible',
  })
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testSteps, setTestSteps] = useState<TestStep[]>([])

  const doAddProvider = useCallback(() => {
    const uuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    const providerId = `${newGeminiProvider.apiType}:${uuid}`
    const name = newGeminiProvider.name.trim()
    const baseUrl = newGeminiProvider.baseUrl.trim()
    const apiKey = newGeminiProvider.apiKey.trim()

    addProvider({
      id: providerId,
      name,
      baseUrl,
      apiKey,
      apiMode: newGeminiProvider.apiType === 'openai-compatible' ? 'openai-official' : 'gemini-sdk',
    })

    setNewGeminiProvider({ name: '', baseUrl: '', apiKey: '', apiType: 'gemini-compatible' })
    setTestStatus('idle')
    setTestSteps([])
    setShowAddGeminiProvider(false)
  }, [newGeminiProvider, addProvider])

  const handleAddGeminiProvider = useCallback(async () => {
    if (!newGeminiProvider.name || !newGeminiProvider.baseUrl) {
      alert(tp('fillRequired'))
      return
    }

    setTestStatus('testing')
    setTestSteps([])

    try {
      const res = await apiFetch('/api/user/api-config/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiType: newGeminiProvider.apiType,
          baseUrl: newGeminiProvider.baseUrl.trim(),
          apiKey: newGeminiProvider.apiKey.trim(),
        }),
      })

      const data = await res.json()
      const steps: TestStep[] = data.steps || []
      setTestSteps(steps)

      if (data.success) {
        setTestStatus('passed')
        // Auto-add on success
        doAddProvider()
      } else {
        setTestStatus('failed')
      }
    } catch {
      setTestSteps([{ name: 'models', status: 'fail', message: 'Network error' }])
      setTestStatus('failed')
    }
  }, [newGeminiProvider, tp, doAddProvider])

  const handleForceAdd = useCallback(() => {
    doAddProvider()
  }, [doAddProvider])

  const handleCancelAddGeminiProvider = () => {
    setNewGeminiProvider({ name: '', baseUrl: '', apiKey: '', apiType: 'gemini-compatible' })
    setTestStatus('idle')
    setTestSteps([])
    setShowAddGeminiProvider(false)
  }

  const handleWorkflowConcurrencyChange = useCallback(
    (field: 'analysis' | 'image' | 'video', rawValue: string) => {
      const parsed = Number.parseInt(rawValue, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) return
      updateWorkflowConcurrency(field, parsed)
    },
    [updateWorkflowConcurrency],
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[var(--glass-text-tertiary)]">
        {tc('loading')}
      </div>
    )
  }



  return (
    <div className="flex h-full flex-col">
      <ApiConfigToolbar
        title={t('title')}
        saveStatus={saveStatus}
        savingState={savingState}
        savingLabel={t('saving')}
        savedLabel={t('saved')}
        saveFailedLabel={t('saveFailed')}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          <DefaultModelCards
            t={t}
            defaultModels={defaultModels}
            getEnabledModelsByType={getEnabledModelsByType}
            parseModelKey={parseModelKey}
            encodeModelKey={encodeModelKey}
            getProviderDisplayName={getProviderDisplayName}
            locale={locale}
            updateDefaultModel={updateDefaultModel}
            batchUpdateDefaultModels={batchUpdateDefaultModels}
            extractCapabilityFieldsFromModel={extractCapabilityFieldsFromModel}
            toCapabilityFieldLabel={toCapabilityFieldLabel}
            capabilityDefaults={capabilityDefaults}
            updateCapabilityDefault={updateCapabilityDefault}
            parseBySample={parseBySample}
            workflowConcurrency={workflowConcurrency}
            handleWorkflowConcurrencyChange={handleWorkflowConcurrencyChange}
          />

          <ApiConfigProviderList
            modelProviders={modelProviders}
            allModels={models}
            defaultModels={defaultModels}
            getModelsForProvider={getModelsForProvider}
            onAddGeminiProvider={() => setShowAddGeminiProvider(true)}
            onToggleModel={toggleModel}
            onUpdateApiKey={updateProviderApiKey}
            onUpdateBaseUrl={updateProviderBaseUrl}
            onReorderProviders={reorderProviders}
            onDeleteModel={deleteModel}
            onUpdateModel={updateModel}
            onDeleteProvider={deleteProvider}
            onAddModel={addModel}
            onFlushConfig={flushConfig}
            onToggleProviderHidden={updateProviderHidden}
            labels={{
              providerPool: t('providerPool'),
              providerPoolDesc: t('providerPoolDesc'),
              dragToSort: t('dragToSort'),
              dragToSortHint: t('dragToSortHint'),
              hideProvider: t('hideProvider'),
              showProvider: t('showProvider'),
              showHiddenProviders: t('showHiddenProviders'),
              hideHiddenProviders: t('hideHiddenProviders'),
              hiddenProvidersPrefix: t('hiddenProvidersPrefix'),
              addGeminiProvider: t('addGeminiProvider'),
            }}
          />
        </div>
      </div>

      <AddCustomProviderModal
        open={showAddGeminiProvider}
        draft={newGeminiProvider}
        testStatus={testStatus}
        testSteps={testSteps}
        onClose={handleCancelAddGeminiProvider}
        onSubmit={handleAddGeminiProvider}
        onForceAdd={handleForceAdd}
        onChange={(updates) =>
          setNewGeminiProvider((previous) => ({ ...previous, ...updates }))}
        t={t}
        tc={tc}
        tp={tp}
      />
    </div>
  )
}
