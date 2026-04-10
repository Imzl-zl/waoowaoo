'use client'

import { logError as _ulogError } from '@/lib/logging/core'
import { apiFetch } from '@/lib/api-fetch'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CapabilitySelections } from '@/lib/model-config-contract'
import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import type { CustomModel, Provider } from './types'
import type { DefaultModels, SaveOverrides, WorkflowConcurrency } from './hook-types'
import { buildApiConfigStateFromResponse } from './config-helpers'

type LatestApiConfigRefs = {
  latestModelsRef: MutableRefObject<CustomModel[]>
  latestProvidersRef: MutableRefObject<Provider[]>
  latestDefaultModelsRef: MutableRefObject<DefaultModels>
  latestWorkflowConcurrencyRef: MutableRefObject<WorkflowConcurrency>
  latestCapabilityDefaultsRef: MutableRefObject<CapabilitySelections>
}

interface UseApiConfigPersistenceParams {
  presetProviders: Provider[]
  models: CustomModel[]
  providers: Provider[]
  defaultModels: DefaultModels
  workflowConcurrency: WorkflowConcurrency
  capabilityDefaults: CapabilitySelections
  setProviders: Dispatch<SetStateAction<Provider[]>>
  setModels: Dispatch<SetStateAction<CustomModel[]>>
  setDefaultModels: Dispatch<SetStateAction<DefaultModels>>
  setWorkflowConcurrency: Dispatch<SetStateAction<WorkflowConcurrency>>
  setCapabilityDefaults: Dispatch<SetStateAction<CapabilitySelections>>
}

export function useApiConfigPersistence(params: UseApiConfigPersistenceParams) {
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const latestModelsRef = useRef(params.models)
  const latestProvidersRef = useRef(params.providers)
  const latestDefaultModelsRef = useRef(params.defaultModels)
  const latestWorkflowConcurrencyRef = useRef(params.workflowConcurrency)
  const latestCapabilityDefaultsRef = useRef(params.capabilityDefaults)

  useEffect(() => { latestModelsRef.current = params.models }, [params.models])
  useEffect(() => { latestProvidersRef.current = params.providers }, [params.providers])
  useEffect(() => { latestDefaultModelsRef.current = params.defaultModels }, [params.defaultModels])
  useEffect(() => { latestWorkflowConcurrencyRef.current = params.workflowConcurrency }, [params.workflowConcurrency])
  useEffect(() => { latestCapabilityDefaultsRef.current = params.capabilityDefaults }, [params.capabilityDefaults])

  const fetchConfig = useCallback(async () => {
    let loadedSuccessfully = false
    try {
      const response = await apiFetch('/api/user/api-config')
      if (!response.ok) {
        throw new Error(`api-config load failed: HTTP ${response.status}`)
      }
      const data = await response.json()
      const nextState = buildApiConfigStateFromResponse({
        data: data as Parameters<typeof buildApiConfigStateFromResponse>[0]['data'],
        presetProviders: params.presetProviders,
      })
      params.setProviders(nextState.providers)
      params.setModels(nextState.models)
      params.setDefaultModels(nextState.defaultModels)
      params.setWorkflowConcurrency(nextState.workflowConcurrency)
      params.setCapabilityDefaults(nextState.capabilityDefaults)
      loadedSuccessfully = true
    } catch (error) {
      _ulogError('获取配置失败:', error)
      setSaveStatus('error')
    } finally {
      setLoading(false)
      if (loadedSuccessfully) {
        setSaveStatus('idle')
      }
    }
  }, [
    params.presetProviders,
    params.setCapabilityDefaults,
    params.setDefaultModels,
    params.setModels,
    params.setProviders,
    params.setWorkflowConcurrency,
  ])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  const performSave = useCallback(async (
    overrides?: SaveOverrides,
    optimistic = false,
    silent = false,
  ): Promise<boolean> => {
    void optimistic
    if (!silent) {
      setSaveStatus('saving')
    }
    try {
      const response = await apiFetch('/api/user/api-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          models: latestModelsRef.current.filter((model) => model.enabled),
          providers: latestProvidersRef.current,
          defaultModels: overrides?.defaultModels ?? latestDefaultModelsRef.current,
          workflowConcurrency: overrides?.workflowConcurrency ?? latestWorkflowConcurrencyRef.current,
          capabilityDefaults: overrides?.capabilityDefaults ?? latestCapabilityDefaultsRef.current,
        }),
      })
      if (!response.ok) {
        if (!silent) setSaveStatus('error')
        return false
      }
      if (!silent) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
      return true
    } catch (error) {
      _ulogError('保存失败:', error)
      if (!silent) setSaveStatus('error')
      return false
    }
  }, [])

  const flushConfig = useCallback(async () => {
    const success = await performSave(undefined, false, true)
    if (!success) {
      throw new Error('API_CONFIG_FLUSH_FAILED')
    }
  }, [performSave])

  return {
    loading,
    saveStatus,
    fetchConfig,
    performSave,
    flushConfig,
    latestModelsRef,
    latestProvidersRef,
    latestDefaultModelsRef,
    latestWorkflowConcurrencyRef,
    latestCapabilityDefaultsRef,
  }
}

export type { LatestApiConfigRefs }
