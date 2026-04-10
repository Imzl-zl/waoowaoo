'use client'

import { useCallback, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { VERIFIABLE_PROVIDER_KEYS } from '../types'
import type { CustomModel, Provider } from '../../types'
import {
  buildProviderConnectionPayload,
  type KeyTestStatus,
  type KeyTestStep,
  pickConfiguredLlmModel,
} from './providerCardStateHelpers'

interface UseProviderConnectionTestParams {
  provider: Provider
  providerKey: string
  models: CustomModel[]
  defaultAnalysisModel?: string
  tempKey: string
  onPersistKey: () => void
}

export function useProviderConnectionTest(params: UseProviderConnectionTestParams) {
  const [keyTestStatus, setKeyTestStatus] = useState<KeyTestStatus>('idle')
  const [keyTestSteps, setKeyTestSteps] = useState<KeyTestStep[]>([])

  const persistKey = useCallback(() => {
    setKeyTestStatus('idle')
    setKeyTestSteps([])
    params.onPersistKey()
  }, [params])

  const handleSaveKey = useCallback(async () => {
    if (!VERIFIABLE_PROVIDER_KEYS.has(params.providerKey)) {
      persistKey()
      return
    }

    setKeyTestStatus('testing')
    setKeyTestSteps([])
    try {
      const fallbackLlmModel = pickConfiguredLlmModel({
        models: params.models,
        defaultAnalysisModel: params.defaultAnalysisModel,
      })
      const payload = buildProviderConnectionPayload({
        providerKey: params.providerKey,
        apiKey: params.tempKey,
        baseUrl: params.provider.baseUrl,
        llmModel: fallbackLlmModel,
      })
      const response = await apiFetch('/api/user/api-config/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      setKeyTestSteps(data.steps || [])
      if (data.success) {
        setKeyTestStatus('passed')
        setTimeout(() => persistKey(), 1500)
      } else {
        setKeyTestStatus('failed')
      }
    } catch {
      setKeyTestSteps([{ name: 'models', status: 'fail', message: 'Network error' }])
      setKeyTestStatus('failed')
    }
  }, [params, persistKey])

  const handleTestOnly = useCallback(async () => {
    setKeyTestStatus('testing')
    setKeyTestSteps([])
    try {
      const fallbackLlmModel = pickConfiguredLlmModel({
        models: params.models,
        defaultAnalysisModel: params.defaultAnalysisModel,
      })
      const payload = buildProviderConnectionPayload({
        providerKey: params.providerKey,
        apiKey: params.provider.apiKey || '',
        baseUrl: params.provider.baseUrl,
        llmModel: fallbackLlmModel,
      })
      const response = await apiFetch('/api/user/api-config/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      setKeyTestSteps(data.steps || [])
      setKeyTestStatus(data.success ? 'passed' : 'failed')
    } catch {
      setKeyTestSteps([{ name: 'models', status: 'fail', message: 'Network error' }])
      setKeyTestStatus('failed')
    }
  }, [params])

  const handleDismissTest = useCallback(() => {
    setKeyTestStatus('idle')
    setKeyTestSteps([])
  }, [])

  return {
    keyTestStatus,
    keyTestSteps,
    handleSaveKey,
    handleForceSaveKey: persistKey,
    handleTestOnly,
    handleDismissTest,
    resetKeyTest: handleDismissTest,
  }
}
