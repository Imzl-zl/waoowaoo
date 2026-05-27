import { withVoiceBilling } from '@/lib/billing/service'
import { getProjectModelConfig } from '@/lib/config-service'
import { generateAudio } from '@/lib/generator-api'
import { processMediaResult } from '@/lib/media-process'
import { ensureMediaObjectFromStorageKey } from '@/lib/media/service'
import type {
  BillPublishedWorkflowAudio,
  GeneratePublishedWorkflowAudio,
  PublishedWorkflowAudioGenerationOptions,
  ResolvePublishedWorkflowAudioModel,
  ResolvePublishedWorkflowAudioOptions,
  StorePublishedWorkflowAudio,
} from './published-workflow-activity-dependencies'

const DEFAULT_AUDIO_RATE = 1
const MIN_AUDIO_RATE = 0.5
const MAX_AUDIO_RATE = 2
const MIN_AUDIO_FREEZE_SECONDS = 5
const MAX_AUDIO_FREEZE_SECONDS = 600

function requireConfigString(config: Readonly<Record<string, unknown>>, key: string): string {
  const value = config[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`published workflow step config ${key} is required`)
  }
  return value.trim()
}

function optionalNumber(
  config: Readonly<Record<string, unknown>>,
  key: string,
): number | undefined {
  const value = config[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function boundedNumber(input: {
  value: number | undefined
  fallback: number
  min: number
  max: number
  label: string
}): number {
  const value = input.value ?? input.fallback
  if (value < input.min || value > input.max) {
    throw new Error(`published workflow audio ${input.label} must be between ${input.min} and ${input.max}`)
  }
  return value
}

export const resolvePublishedWorkflowAudioModelDefault: ResolvePublishedWorkflowAudioModel =
  async ({ workflow }) => {
    const config = await getProjectModelConfig(workflow.projectId, workflow.userId)
    const model = config.audioModel?.trim()
    if (!model) {
      throw new Error('published workflow audio model audioModel is required')
    }
    return { model, modelSlot: 'audioModel' }
  }

export const resolvePublishedWorkflowAudioOptionsDefault: ResolvePublishedWorkflowAudioOptions =
  async ({ step, renderedText }) => {
    if (!renderedText.trim()) {
      throw new Error('published workflow audio text is required')
    }
    return {
      voice: requireConfigString(step.config, 'audioVoice'),
      rate: boundedNumber({
        value: optionalNumber(step.config, 'audioRate'),
        fallback: DEFAULT_AUDIO_RATE,
        min: MIN_AUDIO_RATE,
        max: MAX_AUDIO_RATE,
        label: 'rate',
      }),
      maxFreezeSeconds: boundedNumber({
        value: optionalNumber(step.config, 'audioMaxFreezeSeconds'),
        fallback: MIN_AUDIO_FREEZE_SECONDS,
        min: MIN_AUDIO_FREEZE_SECONDS,
        max: MAX_AUDIO_FREEZE_SECONDS,
        label: 'max freeze seconds',
      }),
    } satisfies PublishedWorkflowAudioGenerationOptions
  }

export const generatePublishedWorkflowAudioDefault: GeneratePublishedWorkflowAudio =
  async (params) => await generateAudio(
    params.userId,
    params.model,
    params.text,
    {
      voice: params.options.voice,
      rate: params.options.rate,
    },
  )

export const billPublishedWorkflowAudioDefault: BillPublishedWorkflowAudio =
  async (params) => await withVoiceBilling(
    params.userId,
    params.maxFreezeSeconds,
    params.model,
    {
      projectId: params.projectId,
      action: params.action,
      billingKey: params.billingKey,
      metadata: params.metadata,
    },
    params.execute,
  )

export const storePublishedWorkflowAudioDefault: StorePublishedWorkflowAudio =
  async ({ workflow, step, source, downloadHeaders }) => {
    const storageKey = await processMediaResult({
      source,
      type: 'audio',
      keyPrefix: 'workflow-media',
      targetId: `${workflow.runId}-${step.stepKey}`,
      downloadHeaders,
    })
    const mediaRef = await ensureMediaObjectFromStorageKey(storageKey)
    return { storageKey, mediaRef }
  }
