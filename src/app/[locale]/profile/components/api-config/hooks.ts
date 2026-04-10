'use client'
import { useLocale, useTranslations } from 'next-intl'

import { useMemo, useState } from 'react'
import {
    PRESET_PROVIDERS,
    resolvePresetProviderName,
    type Provider,
    type CustomModel,
} from './types'
import type { CapabilitySelections } from '@/lib/model-config-contract'
import {
  createInitialModels,
  createInitialProviders,
  DEFAULT_WORKFLOW_CONCURRENCY,
} from './config-helpers'
import type { DefaultModels, UseProvidersReturn, WorkflowConcurrency } from './hook-types'
import { useApiConfigPersistence } from './useApiConfigPersistence'
import { useApiConfigMutations } from './useApiConfigMutations'

export { mergeProvidersForDisplay } from './config-helpers'
export type { DefaultModels, WorkflowConcurrency } from './hook-types'

export function useProviders(): UseProvidersReturn {
  const locale = useLocale()
  const t = useTranslations('apiConfig')
  const presetProviders = useMemo(
    () => PRESET_PROVIDERS.map((provider) => ({
      ...provider,
      name: resolvePresetProviderName(provider.id, provider.name, locale),
    })),
    [locale],
  )
  const [providers, setProviders] = useState<Provider[]>(() => createInitialProviders(presetProviders))
  const [models, setModels] = useState<CustomModel[]>(() => createInitialModels())
  const [defaultModels, setDefaultModels] = useState<DefaultModels>({})
  const [workflowConcurrency, setWorkflowConcurrency] = useState<WorkflowConcurrency>(DEFAULT_WORKFLOW_CONCURRENCY)
  const [capabilityDefaults, setCapabilityDefaults] = useState<CapabilitySelections>({})

  const persistence = useApiConfigPersistence({
    presetProviders,
    models,
    providers,
    defaultModels,
    workflowConcurrency,
    capabilityDefaults,
    setProviders,
    setModels,
    setDefaultModels,
    setWorkflowConcurrency,
    setCapabilityDefaults,
  })

  const mutations = useApiConfigMutations({
    t,
    models,
    setProviders,
    setModels,
    setDefaultModels,
    setWorkflowConcurrency,
    setCapabilityDefaults,
    refs: {
      latestModelsRef: persistence.latestModelsRef,
      latestProvidersRef: persistence.latestProvidersRef,
      latestDefaultModelsRef: persistence.latestDefaultModelsRef,
      latestWorkflowConcurrencyRef: persistence.latestWorkflowConcurrencyRef,
      latestCapabilityDefaultsRef: persistence.latestCapabilityDefaultsRef,
    },
    performSave: persistence.performSave,
    fetchConfig: persistence.fetchConfig,
  })

  return {
    providers,
    models,
    defaultModels,
    workflowConcurrency,
    capabilityDefaults,
    loading: persistence.loading,
    saveStatus: persistence.saveStatus,
    flushConfig: persistence.flushConfig,
    ...mutations,
  }
}
