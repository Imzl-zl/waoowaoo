'use client'

import { useCallback } from 'react'
import type { CapabilitySelections, CapabilityValue } from '@/lib/model-config-contract'
import { normalizeWorkflowConcurrencyValue } from '@/lib/workflow-concurrency'
import type { CustomModel, Provider } from './types'
import type { DefaultModels, SaveOverrides, WorkflowConcurrency } from './hook-types'
import type { LatestApiConfigRefs } from './useApiConfigPersistence'
import {
  applyCapabilityDefaultsSelection,
  clearUnavailableDefaultModels,
  DEFAULT_WORKFLOW_CONCURRENCY,
  replaceDefaultModelKey,
} from './config-helpers'
import { encodeModelKey, getProviderKey, isPresetComingSoonModelKey, PRESET_MODELS, PRESET_PROVIDERS } from './types'
import type { Dispatch, SetStateAction } from 'react'

interface UseApiConfigMutationsParams {
  t: (key: string) => string
  models: CustomModel[]
  setProviders: Dispatch<SetStateAction<Provider[]>>
  setModels: Dispatch<SetStateAction<CustomModel[]>>
  setDefaultModels: Dispatch<SetStateAction<DefaultModels>>
  setWorkflowConcurrency: Dispatch<SetStateAction<WorkflowConcurrency>>
  setCapabilityDefaults: Dispatch<SetStateAction<CapabilitySelections>>
  refs: LatestApiConfigRefs
  performSave: (overrides?: SaveOverrides, optimistic?: boolean, silent?: boolean) => Promise<boolean>
  fetchConfig: () => Promise<void>
}

export function useApiConfigMutations(params: UseApiConfigMutationsParams) {
  const updateDefaultModel = useCallback((
    field: string,
    modelKey: string,
    capabilityFieldsToDefault?: Array<{ field: string; options: CapabilityValue[] }>,
  ) => {
    params.setDefaultModels((previous) => {
      const next = { ...previous, [field]: modelKey }
      params.refs.latestDefaultModelsRef.current = next

      const nextCapabilityDefaults = applyCapabilityDefaultsSelection(
        params.refs.latestCapabilityDefaultsRef.current,
        modelKey,
        capabilityFieldsToDefault,
      )
      if (nextCapabilityDefaults.changed) {
        params.setCapabilityDefaults(nextCapabilityDefaults.next)
        params.refs.latestCapabilityDefaultsRef.current = nextCapabilityDefaults.next
        void params.performSave({ defaultModels: next, capabilityDefaults: nextCapabilityDefaults.next }, true)
      } else {
        void params.performSave({ defaultModels: next }, true)
      }
      return next
    })
  }, [params])

  const batchUpdateDefaultModels = useCallback((
    fields: string[],
    modelKey: string,
    capabilityFieldsToDefault?: Array<{ field: string; options: CapabilityValue[] }>,
  ) => {
    params.setDefaultModels((previous) => {
      const next = { ...previous }
      for (const field of fields) {
        ;(next as Record<string, string | undefined>)[field] = modelKey
      }
      params.refs.latestDefaultModelsRef.current = next

      const nextCapabilityDefaults = applyCapabilityDefaultsSelection(
        params.refs.latestCapabilityDefaultsRef.current,
        modelKey,
        capabilityFieldsToDefault,
      )
      if (nextCapabilityDefaults.changed) {
        params.setCapabilityDefaults(nextCapabilityDefaults.next)
        params.refs.latestCapabilityDefaultsRef.current = nextCapabilityDefaults.next
        void params.performSave({ defaultModels: next, capabilityDefaults: nextCapabilityDefaults.next }, true)
      } else {
        void params.performSave({ defaultModels: next }, true)
      }
      return next
    })
  }, [params])

  const updateCapabilityDefault = useCallback((modelKey: string, field: string, value: string | number | boolean | null) => {
    params.setCapabilityDefaults((previous) => {
      const next: CapabilitySelections = { ...previous }
      const current = { ...(next[modelKey] || {}) }
      if (value === null) {
        delete current[field]
      } else {
        current[field] = value
      }

      if (Object.keys(current).length === 0) {
        delete next[modelKey]
      } else {
        next[modelKey] = current
      }
      params.refs.latestCapabilityDefaultsRef.current = next
      void params.performSave({ capabilityDefaults: next }, true)
      return next
    })
  }, [params])

  const updateWorkflowConcurrency = useCallback((field: keyof WorkflowConcurrency, value: number) => {
    const nextValue = normalizeWorkflowConcurrencyValue(value, DEFAULT_WORKFLOW_CONCURRENCY[field])
    params.setWorkflowConcurrency((previous) => {
      const next = { ...previous, [field]: nextValue }
      params.refs.latestWorkflowConcurrencyRef.current = next
      void params.performSave({ workflowConcurrency: next }, true)
      return next
    })
  }, [params])

  const updateProviderApiKey = useCallback((providerId: string, apiKey: string) => {
    params.setProviders((previous) => {
      const next = previous.map((provider) =>
        provider.id === providerId ? { ...provider, apiKey, hasApiKey: !!apiKey } : provider,
      )
      params.refs.latestProvidersRef.current = next
      void params.performSave(undefined, true)
      return next
    })
  }, [params])

  const updateProviderHidden = useCallback((providerId: string, hidden: boolean) => {
    params.setProviders((previous) => {
      const next = previous.map((provider) =>
        provider.id === providerId ? { ...provider, hidden } : provider,
      )
      params.refs.latestProvidersRef.current = next
      void params.performSave(undefined, true)
      return next
    })
  }, [params])

  const reorderProviders = useCallback((activeProviderId: string, overProviderId: string) => {
    if (activeProviderId === overProviderId) return
    params.setProviders((previous) => {
      const oldIndex = previous.findIndex((provider) => provider.id === activeProviderId)
      const newIndex = previous.findIndex((provider) => provider.id === overProviderId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        return previous
      }

      const next = [...previous]
      const moved = next[oldIndex]
      if (!moved) return previous
      next.splice(oldIndex, 1)
      next.splice(newIndex, 0, moved)
      params.refs.latestProvidersRef.current = next
      void params.performSave(undefined, true)
      return next
    })
  }, [params])

  const addProvider = useCallback((provider: Omit<Provider, 'hasApiKey'>) => {
    params.setProviders((previous) => {
      const normalizedProviderId = provider.id.toLowerCase()
      if (previous.some((item) => item.id.toLowerCase() === normalizedProviderId)) {
        alert(params.t('providerIdExists'))
        return previous
      }
      const newProvider: Provider = { ...provider, hasApiKey: !!provider.apiKey }
      const next = [...previous, newProvider]
      params.refs.latestProvidersRef.current = next

      const providerKey = getProviderKey(provider.id)
      if (providerKey === 'gemini-compatible') {
        void params.performSave(undefined, true).then(() => void params.fetchConfig())
      } else {
        void params.performSave(undefined, true)
      }
      return next
    })
  }, [params])

  const deleteProvider = useCallback((providerId: string) => {
    if (PRESET_PROVIDERS.find((provider) => provider.id === providerId)) {
      alert(params.t('presetProviderCannotDelete'))
      return
    }
    if (!confirm(params.t('confirmDeleteProvider'))) return

    params.setProviders((previous) => {
      const next = previous.filter((provider) => provider.id !== providerId)
      params.refs.latestProvidersRef.current = next
      return next
    })
    params.setModels((previous) => {
      const nextModels = previous.filter((model) => model.provider !== providerId)
      params.setDefaultModels((previousDefaults) => {
        const nextDefaults = clearUnavailableDefaultModels(
          previousDefaults,
          new Set(nextModels.map((model) => model.modelKey)),
        )
        params.refs.latestDefaultModelsRef.current = nextDefaults
        return nextDefaults
      })
      params.refs.latestModelsRef.current = nextModels
      void params.performSave(undefined, true)
      return nextModels
    })
  }, [params])

  const updateProviderInfo = useCallback((providerId: string, name: string, baseUrl?: string) => {
    params.setProviders((previous) => {
      const next = previous.map((provider) =>
        provider.id === providerId ? { ...provider, name, baseUrl } : provider,
      )
      params.refs.latestProvidersRef.current = next
      void params.performSave(undefined, true)
      return next
    })
  }, [params])

  const updateProviderBaseUrl = useCallback((providerId: string, baseUrl: string) => {
    params.setProviders((previous) => {
      const next = previous.map((provider) =>
        provider.id === providerId ? { ...provider, baseUrl } : provider,
      )
      params.refs.latestProvidersRef.current = next
      void params.performSave(undefined, true)
      return next
    })
  }, [params])

  const toggleModel = useCallback((modelKey: string, providerId?: string) => {
    if (isPresetComingSoonModelKey(modelKey)) return
    params.setModels((previous) => {
      const next = previous.map((model) =>
        model.modelKey === modelKey && (providerId ? model.provider === providerId : true)
          ? { ...model, enabled: !model.enabled }
          : model,
      )
      params.refs.latestModelsRef.current = next
      void params.performSave(undefined, true)
      return next
    })
  }, [params])

  const updateModel = useCallback((modelKey: string, updates: Partial<CustomModel>, providerId?: string) => {
    let nextModelKey = ''
    params.setModels((previous) => {
      const next = previous.map((model) => {
        if (model.modelKey !== modelKey || (providerId ? model.provider !== providerId : false)) return model
        const mergedProvider = updates.provider ?? model.provider
        const mergedModelId = updates.modelId ?? model.modelId
        nextModelKey = encodeModelKey(mergedProvider, mergedModelId)
        return {
          ...model,
          ...updates,
          provider: mergedProvider,
          modelId: mergedModelId,
          modelKey: nextModelKey,
          name: updates.name ?? model.name,
          price: updates.price ?? model.price,
        }
      })
      params.refs.latestModelsRef.current = next
      return next
    })
    if (nextModelKey && nextModelKey !== modelKey) {
      params.setDefaultModels((previous) => {
        const next = replaceDefaultModelKey(previous, modelKey, nextModelKey)
        params.refs.latestDefaultModelsRef.current = next
        return next
      })
    }
    void params.performSave(undefined, false)
  }, [params])

  const addModel = useCallback((model: Omit<CustomModel, 'enabled'>) => {
    params.setModels((previous) => {
      const next = [
        ...previous,
        {
          ...model,
          modelKey: model.modelKey || encodeModelKey(model.provider, model.modelId),
          price: 0,
          priceLabel: '--',
          enabled: true,
        },
      ]
      params.refs.latestModelsRef.current = next
      void params.performSave(undefined, false)
      return next
    })
  }, [params])

  const deleteModel = useCallback((modelKey: string, providerId?: string) => {
    if (PRESET_MODELS.find((model) => {
      const presetModelKey = encodeModelKey(model.provider, model.modelId)
      return presetModelKey === modelKey && (providerId ? model.provider === providerId : true)
    })) {
      alert(params.t('presetModelCannotDelete'))
      return
    }
    if (!confirm(params.t('confirmDeleteModel'))) return

    params.setModels((previous) => {
      const nextModels = previous.filter((model) =>
        !(model.modelKey === modelKey && (providerId ? model.provider === providerId : true)),
      )
      params.setDefaultModels((previousDefaults) => {
        const nextDefaults = clearUnavailableDefaultModels(
          previousDefaults,
          new Set(nextModels.map((model) => model.modelKey)),
        )
        params.refs.latestDefaultModelsRef.current = nextDefaults
        return nextDefaults
      })
      params.refs.latestModelsRef.current = nextModels
      void params.performSave(undefined, true)
      return nextModels
    })
  }, [params])

  const getModelsByType = useCallback((type: CustomModel['type']) => {
    return params.models.filter((model) => model.type === type)
  }, [params.models])

  return {
    updateProviderHidden,
    updateProviderApiKey,
    updateProviderBaseUrl,
    reorderProviders,
    addProvider,
    deleteProvider,
    updateProviderInfo,
    toggleModel,
    updateModel,
    addModel,
    deleteModel,
    updateDefaultModel,
    batchUpdateDefaultModels,
    updateWorkflowConcurrency,
    updateCapabilityDefault,
    getModelsByType,
  }
}
