import { withVideoBilling } from '@/lib/billing/service'
import {
  getProjectModelConfig,
  resolveProjectModelCapabilityGenerationOptions,
} from '@/lib/config-service'
import { generateVideo } from '@/lib/generator-api'
import { processMediaResult } from '@/lib/media-process'
import { ensureMediaObjectFromStorageKey } from '@/lib/media/service'
import { normalizeToBase64ForGeneration } from '@/lib/media/outbound-image'
import type {
  BillPublishedWorkflowVideo,
  GeneratePublishedWorkflowVideo,
  PublishedWorkflowVideoGenerationOptions,
  ResolvePublishedWorkflowVideoModel,
  ResolvePublishedWorkflowVideoOptions,
  ResolvePublishedWorkflowVideoSourceImage,
  StorePublishedWorkflowVideo,
} from './published-workflow-activity-dependencies'

type ImageSourceCandidate = Readonly<{
  sourceStepKey: string
  imageUrl: string
  storageKey?: string | null
}>

function configSelections(config: Readonly<Record<string, unknown>>): Record<string, string | number | boolean> {
  const selections: Record<string, string | number | boolean> = {
    generationMode: 'normal',
  }
  const duration = config.videoDuration
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    selections.duration = duration
  }
  const resolution = config.videoResolution
  if (typeof resolution === 'string' && resolution.trim()) {
    selections.resolution = resolution.trim()
  }
  const generateAudio = config.generateAudio
  if (typeof generateAudio === 'boolean') {
    selections.generateAudio = generateAudio
  }
  return selections
}

function providerOptions(options: PublishedWorkflowVideoGenerationOptions) {
  const output: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(options)) {
    if (key === 'generationMode') continue
    output[key] = value
  }
  return output
}

function readImageSourceCandidate(
  sourceStepKey: string,
  payload: unknown,
): ImageSourceCandidate | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const record = payload as Record<string, unknown>
  if (record.mediaKind !== 'image') return null
  const media = record.media && typeof record.media === 'object' && !Array.isArray(record.media)
    ? record.media as Record<string, unknown>
    : null
  const storageKey = typeof record.storageKey === 'string' && record.storageKey.trim()
    ? record.storageKey.trim()
    : typeof media?.storageKey === 'string' && media.storageKey.trim()
      ? media.storageKey.trim()
      : null
  const mediaUrl = typeof media?.url === 'string' && media.url.trim() ? media.url.trim() : null
  const imageUrl = storageKey || mediaUrl
  if (!imageUrl) return null
  return { sourceStepKey, imageUrl, storageKey }
}

export const resolvePublishedWorkflowVideoModelDefault: ResolvePublishedWorkflowVideoModel =
  async ({ workflow }) => {
    const config = await getProjectModelConfig(workflow.projectId, workflow.userId)
    const model = config.videoModel?.trim()
    if (!model) {
      throw new Error('published workflow video model videoModel is required')
    }
    return { model, modelSlot: 'videoModel' }
  }

export const resolvePublishedWorkflowVideoOptionsDefault: ResolvePublishedWorkflowVideoOptions =
  async ({ workflow, step, model }) => {
    const capabilityOptions = await resolveProjectModelCapabilityGenerationOptions({
      projectId: workflow.projectId,
      userId: workflow.userId,
      modelType: 'video',
      modelKey: model,
      runtimeSelections: configSelections(step.config),
    })
    const aspectRatio = step.config.aspectRatio
    return {
      ...capabilityOptions,
      ...(typeof aspectRatio === 'string' && aspectRatio.trim()
        ? { aspectRatio: aspectRatio.trim() }
        : {}),
    } satisfies PublishedWorkflowVideoGenerationOptions
  }

export const resolvePublishedWorkflowVideoSourceImageDefault: ResolvePublishedWorkflowVideoSourceImage =
  async ({ step, context }) => {
    const candidates = step.dependsOn
      .map((sourceStepKey) => readImageSourceCandidate(sourceStepKey, context[sourceStepKey]?.artifactPayload))
      .filter((item): item is ImageSourceCandidate => item !== null)
    if (candidates.length === 0) {
      throw new Error(`published workflow media.generate video step ${step.stepKey} requires one direct image media dependency`)
    }
    if (candidates.length > 1) {
      throw new Error(`published workflow media.generate video step ${step.stepKey} has multiple direct image media dependencies`)
    }
    const candidate = candidates[0]
    return {
      sourceStepKey: candidate.sourceStepKey,
      storageKey: candidate.storageKey,
      imageUrl: await normalizeToBase64ForGeneration(candidate.imageUrl),
    }
  }

export const generatePublishedWorkflowVideoDefault: GeneratePublishedWorkflowVideo =
  async (params) => await generateVideo(
    params.userId,
    params.model,
    params.imageUrl,
    {
      ...providerOptions(params.options),
      prompt: params.prompt,
    },
  )

export const billPublishedWorkflowVideoDefault: BillPublishedWorkflowVideo =
  async (params) => await withVideoBilling(
    params.userId,
    params.model,
    params.resolution,
    params.maxCount,
    {
      projectId: params.projectId,
      action: params.action,
      billingKey: params.billingKey,
      metadata: params.metadata,
    },
    params.execute,
  )

export const storePublishedWorkflowVideoDefault: StorePublishedWorkflowVideo =
  async ({ workflow, step, source, downloadHeaders }) => {
    const storageKey = await processMediaResult({
      source,
      type: 'video',
      keyPrefix: 'workflow-media',
      targetId: `${workflow.runId}-${step.stepKey}`,
      downloadHeaders,
    })
    const mediaRef = await ensureMediaObjectFromStorageKey(storageKey)
    return { storageKey, mediaRef }
  }
