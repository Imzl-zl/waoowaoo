'use client'

import type { CapabilitySelections, CapabilityValue } from '@/lib/model-config-contract'
import type { CustomModel, Provider } from './types'

export interface DefaultModels {
  analysisModel?: string
  characterModel?: string
  locationModel?: string
  storyboardModel?: string
  editModel?: string
  videoModel?: string
  audioModel?: string
  lipSyncModel?: string
  voiceDesignModel?: string
}

export interface WorkflowConcurrency {
  analysis: number
  image: number
  video: number
}

export interface UseProvidersReturn {
  providers: Provider[]
  models: CustomModel[]
  defaultModels: DefaultModels
  workflowConcurrency: WorkflowConcurrency
  capabilityDefaults: CapabilitySelections
  loading: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  flushConfig: () => Promise<void>
  updateProviderHidden: (providerId: string, hidden: boolean) => void
  updateProviderApiKey: (providerId: string, apiKey: string) => void
  updateProviderBaseUrl: (providerId: string, baseUrl: string) => void
  reorderProviders: (activeProviderId: string, overProviderId: string) => void
  addProvider: (provider: Omit<Provider, 'hasApiKey'>) => void
  deleteProvider: (providerId: string) => void
  updateProviderInfo: (providerId: string, name: string, baseUrl?: string) => void
  toggleModel: (modelKey: string, providerId?: string) => void
  updateModel: (modelKey: string, updates: Partial<CustomModel>, providerId?: string) => void
  addModel: (model: Omit<CustomModel, 'enabled'>) => void
  deleteModel: (modelKey: string, providerId?: string) => void
  updateDefaultModel: (
    field: string,
    modelKey: string,
    capabilityFieldsToDefault?: Array<{ field: string; options: CapabilityValue[] }>,
  ) => void
  batchUpdateDefaultModels: (
    fields: string[],
    modelKey: string,
    capabilityFieldsToDefault?: Array<{ field: string; options: CapabilityValue[] }>,
  ) => void
  updateWorkflowConcurrency: (field: keyof WorkflowConcurrency, value: number) => void
  updateCapabilityDefault: (modelKey: string, field: string, value: string | number | boolean | null) => void
  getModelsByType: (type: CustomModel['type']) => CustomModel[]
}

export interface SaveOverrides {
  defaultModels?: DefaultModels
  workflowConcurrency?: WorkflowConcurrency
  capabilityDefaults?: CapabilitySelections
}
