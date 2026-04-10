import { prisma } from '@/lib/prisma'

const USER_PREFERENCE_ANALYSIS_MODEL_SELECT = {
  analysisModel: true,
} as const

const USER_PREFERENCE_CUSTOM_MODELS_SELECT = {
  customModels: true,
} as const

const USER_PREFERENCE_AUDIO_MODEL_SELECT = {
  audioModel: true,
} as const

const USER_PREFERENCE_LIPSYNC_MODEL_SELECT = {
  lipSyncModel: true,
} as const

const USER_PREFERENCE_WORKFLOW_CONCURRENCY_SELECT = {
  analysisConcurrency: true,
  imageConcurrency: true,
  videoConcurrency: true,
} as const

const USER_PREFERENCE_MODEL_CONFIG_SELECT = {
  analysisModel: true,
  characterModel: true,
  locationModel: true,
  storyboardModel: true,
  editModel: true,
  videoModel: true,
  audioModel: true,
  capabilityDefaults: true,
} as const

const USER_PREFERENCE_PROJECT_DEFAULTS_SELECT = {
  analysisModel: true,
  characterModel: true,
  locationModel: true,
  storyboardModel: true,
  editModel: true,
  videoModel: true,
  audioModel: true,
  videoRatio: true,
  artStyle: true,
  ttsRate: true,
} as const

export async function ensureUserPreference(userId: string) {
  return await prisma.userPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

export async function upsertUserPreferenceFields<T extends Record<string, unknown>>(userId: string, updateData: T) {
  return await prisma.userPreference.upsert({
    where: { userId },
    update: updateData,
    create: { userId, ...updateData },
  })
}

export async function readUserPreferenceFields<TSelect extends Record<string, true>>(userId: string, select: TSelect) {
  return await prisma.userPreference.findUnique({
    where: { userId },
    select,
  })
}

export async function readUserPreferenceAnalysisModel(userId: string) {
  return await readUserPreferenceFields(userId, USER_PREFERENCE_ANALYSIS_MODEL_SELECT)
}

export async function readUserPreferenceCustomModels(userId: string) {
  return await readUserPreferenceFields(userId, USER_PREFERENCE_CUSTOM_MODELS_SELECT)
}

export async function readUserPreferenceAudioModel(userId: string) {
  return await readUserPreferenceFields(userId, USER_PREFERENCE_AUDIO_MODEL_SELECT)
}

export async function readUserPreferenceLipSyncModel(userId: string) {
  return await readUserPreferenceFields(userId, USER_PREFERENCE_LIPSYNC_MODEL_SELECT)
}

export async function readUserPreferenceWorkflowConcurrency(userId: string) {
  return await readUserPreferenceFields(userId, USER_PREFERENCE_WORKFLOW_CONCURRENCY_SELECT)
}

export async function readUserPreferenceModelConfig(userId: string) {
  return await readUserPreferenceFields(userId, USER_PREFERENCE_MODEL_CONFIG_SELECT)
}

export async function readUserPreferenceProjectDefaults(userId: string) {
  return await readUserPreferenceFields(userId, USER_PREFERENCE_PROJECT_DEFAULTS_SELECT)
}
