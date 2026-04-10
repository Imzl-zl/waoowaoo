import { decryptApiKey, encryptApiKey } from '@/lib/crypto-utils'
import {
  readUserPreferenceFields,
  upsertUserPreferenceFields,
} from '@/lib/user-preference/persistence'
import { normalizeWorkflowConcurrencyConfig } from '@/lib/workflow-concurrency'
import type {
  DefaultModelsPayload,
  StoredProvider,
  WorkflowConcurrencyPayload,
} from './types'
import { DEFAULT_LIPSYNC_MODEL_KEY } from './default-models'

const API_CONFIG_SELECT = {
  customModels: true,
  customProviders: true,
  analysisModel: true,
  characterModel: true,
  locationModel: true,
  storyboardModel: true,
  editModel: true,
  videoModel: true,
  audioModel: true,
  lipSyncModel: true,
  voiceDesignModel: true,
  capabilityDefaults: true,
  analysisConcurrency: true,
  imageConcurrency: true,
  videoConcurrency: true,
} as const

const API_CONFIG_EXISTING_SELECT = {
  customProviders: true,
  customModels: true,
} as const

export async function readUserApiConfigPreference(userId: string) {
  return await readUserPreferenceFields(userId, API_CONFIG_SELECT)
}

export async function readUserApiConfigExistingPreference(userId: string) {
  return await readUserPreferenceFields(userId, API_CONFIG_EXISTING_SELECT)
}

export function decryptStoredProviders(providers: StoredProvider[]): StoredProvider[] {
  return providers.map((provider) => ({
    ...provider,
    apiKey: provider.apiKey ? decryptApiKey(provider.apiKey) : '',
  }))
}

export function serializeProvidersForStorage(params: {
  normalizedProviders: StoredProvider[]
  existingProviders: StoredProvider[]
}) {
  return params.normalizedProviders.map((provider) => {
    const existing = params.existingProviders.find((candidate) => candidate.id === provider.id)
    let finalApiKey: string | undefined
    if (provider.apiKey === undefined) {
      finalApiKey = existing?.apiKey
    } else if (provider.apiKey === '') {
      finalApiKey = undefined
    } else {
      finalApiKey = encryptApiKey(provider.apiKey)
    }
    const finalHidden = provider.hidden === undefined
      ? existing?.hidden === true
      : provider.hidden === true

    return {
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      hidden: finalHidden,
      apiMode: provider.apiMode,
      gatewayRoute: provider.gatewayRoute,
      apiKey: finalApiKey,
    }
  })
}

export function buildRawDefaultModels(pref: Partial<Record<keyof DefaultModelsPayload, string | null | undefined>>): DefaultModelsPayload {
  return {
    analysisModel: pref.analysisModel || '',
    characterModel: pref.characterModel || '',
    locationModel: pref.locationModel || '',
    storyboardModel: pref.storyboardModel || '',
    editModel: pref.editModel || '',
    videoModel: pref.videoModel || '',
    audioModel: pref.audioModel || '',
    lipSyncModel: pref.lipSyncModel || DEFAULT_LIPSYNC_MODEL_KEY,
    voiceDesignModel: pref.voiceDesignModel || '',
  }
}

export function applyDefaultModelUpdates(updateData: Record<string, unknown>, defaults: DefaultModelsPayload) {
  if (defaults.analysisModel !== undefined) updateData.analysisModel = defaults.analysisModel || null
  if (defaults.characterModel !== undefined) updateData.characterModel = defaults.characterModel || null
  if (defaults.locationModel !== undefined) updateData.locationModel = defaults.locationModel || null
  if (defaults.storyboardModel !== undefined) updateData.storyboardModel = defaults.storyboardModel || null
  if (defaults.editModel !== undefined) updateData.editModel = defaults.editModel || null
  if (defaults.videoModel !== undefined) updateData.videoModel = defaults.videoModel || null
  if (defaults.audioModel !== undefined) updateData.audioModel = defaults.audioModel || null
  if (defaults.lipSyncModel !== undefined) updateData.lipSyncModel = defaults.lipSyncModel || null
  if (defaults.voiceDesignModel !== undefined) updateData.voiceDesignModel = defaults.voiceDesignModel || null
}

export function applyWorkflowConcurrencyUpdates(
  updateData: Record<string, unknown>,
  workflowConcurrency: WorkflowConcurrencyPayload,
) {
  if (workflowConcurrency.analysis !== undefined) updateData.analysisConcurrency = workflowConcurrency.analysis
  if (workflowConcurrency.image !== undefined) updateData.imageConcurrency = workflowConcurrency.image
  if (workflowConcurrency.video !== undefined) updateData.videoConcurrency = workflowConcurrency.video
}

export function readWorkflowConcurrencyFromPreference(pref: {
  analysisConcurrency?: number | null
  imageConcurrency?: number | null
  videoConcurrency?: number | null
}) {
  return normalizeWorkflowConcurrencyConfig({
    analysis: pref.analysisConcurrency,
    image: pref.imageConcurrency,
    video: pref.videoConcurrency,
  })
}

export async function upsertUserApiConfigPreference(userId: string, updateData: Record<string, unknown>) {
  await upsertUserPreferenceFields(userId, updateData)
}
