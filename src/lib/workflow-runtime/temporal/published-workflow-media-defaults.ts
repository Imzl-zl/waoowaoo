import { withImageBilling } from '@/lib/billing/service'
import {
  getProjectModelConfig,
  resolveProjectModelCapabilityGenerationOptions,
  type ProjectModelConfig,
} from '@/lib/config-service'
import { generateImage } from '@/lib/generator-api'
import { pollAsyncTask } from '@/lib/async-poll'
import { processMediaResult } from '@/lib/media-process'
import { ensureMediaObjectFromStorageKey } from '@/lib/media/service'
import type {
  BillPublishedWorkflowImage,
  GeneratePublishedWorkflowImage,
  PollPublishedWorkflowMediaExternalJob,
  PublishedWorkflowImageGenerationOptions,
  PublishedWorkflowImageModelSlot,
  ResolvePublishedWorkflowImageModel,
  ResolvePublishedWorkflowImageOptions,
  StorePublishedWorkflowImage,
} from './published-workflow-activity-dependencies'

const IMAGE_MODEL_SLOTS = new Set<PublishedWorkflowImageModelSlot>([
  'storyboardModel',
  'characterModel',
  'locationModel',
  'editModel',
])

function requireConfigString(config: Readonly<Record<string, unknown>>, key: string): string {
  const value = config[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`published workflow step config ${key} is required`)
  }
  return value.trim()
}

function readImageModelSlot(config: Readonly<Record<string, unknown>>): PublishedWorkflowImageModelSlot {
  const value = requireConfigString(config, 'imageModelSlot')
  if (IMAGE_MODEL_SLOTS.has(value as PublishedWorkflowImageModelSlot)) {
    return value as PublishedWorkflowImageModelSlot
  }
  throw new Error(`unsupported published workflow image model slot: ${value}`)
}

function modelFromSlot(config: ProjectModelConfig, slot: PublishedWorkflowImageModelSlot): string {
  const model = config[slot]?.trim()
  if (!model) {
    throw new Error(`published workflow image model ${slot} is required`)
  }
  return model
}

function runtimeSelections(config: Readonly<Record<string, unknown>>): Record<string, string | number | boolean> {
  const selections: Record<string, string | number | boolean> = {}
  const resolution = config.resolution
  if (typeof resolution === 'string' && resolution.trim()) {
    selections.resolution = resolution.trim()
  }
  return selections
}

export const resolvePublishedWorkflowImageModelDefault: ResolvePublishedWorkflowImageModel =
  async ({ workflow, step }) => {
    const slot = readImageModelSlot(step.config)
    const config = await getProjectModelConfig(workflow.projectId, workflow.userId)
    return {
      model: modelFromSlot(config, slot),
      modelSlot: slot,
    }
  }

export const resolvePublishedWorkflowImageOptionsDefault: ResolvePublishedWorkflowImageOptions =
  async ({ workflow, step, model }) => {
    const capabilityOptions = await resolveProjectModelCapabilityGenerationOptions({
      projectId: workflow.projectId,
      userId: workflow.userId,
      modelType: 'image',
      modelKey: model,
      runtimeSelections: runtimeSelections(step.config),
    })
    const aspectRatio = step.config.aspectRatio
    return {
      ...capabilityOptions,
      ...(typeof aspectRatio === 'string' && aspectRatio.trim()
        ? { aspectRatio: aspectRatio.trim() }
        : {}),
    } satisfies PublishedWorkflowImageGenerationOptions
  }

export const generatePublishedWorkflowImageDefault: GeneratePublishedWorkflowImage =
  async (params) => await generateImage(
    params.userId,
    params.model,
    params.prompt,
    params.options,
  )

export const pollPublishedWorkflowMediaExternalJobDefault: PollPublishedWorkflowMediaExternalJob =
  async ({ userId, externalId }) => await pollAsyncTask(externalId, userId)

export const billPublishedWorkflowImageDefault: BillPublishedWorkflowImage =
  async (params) => await withImageBilling(
    params.userId,
    params.model,
    params.count,
    {
      projectId: params.projectId,
      action: params.action,
      billingKey: params.billingKey,
      metadata: params.metadata,
    },
    params.execute,
  )

export const storePublishedWorkflowImageDefault: StorePublishedWorkflowImage =
  async ({ workflow, step, source }) => {
    const storageKey = await processMediaResult({
      source,
      type: 'image',
      keyPrefix: 'workflow-media',
      targetId: `${workflow.runId}-${step.stepKey}`,
    })
    const mediaRef = await ensureMediaObjectFromStorageKey(storageKey)
    return { storageKey, mediaRef }
  }
