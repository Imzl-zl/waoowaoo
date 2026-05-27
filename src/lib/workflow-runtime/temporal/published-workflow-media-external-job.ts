import { ApplicationFailure } from '@temporalio/common'
import type {
  CreatePublishedWorkflowArtifact,
  PollPublishedWorkflowMediaExternalJob,
  PublishedWorkflowImageGenerateResult,
  PublishedWorkflowAudioGenerateResult,
  PublishedWorkflowMediaPollResult,
  PublishedWorkflowVideoGenerateResult,
} from './published-workflow-activity-dependencies'
import {
  persistMediaExternalJob,
  type PublishedWorkflowMediaExternalJob,
} from './published-workflow-media-cache'
import type {
  TemporalPublishedWorkflowStep,
  TemporalWorkflowRunInput,
} from './types'

type PublishedWorkflowMediaGenerateResult =
  | PublishedWorkflowImageGenerateResult
  | PublishedWorkflowAudioGenerateResult
  | PublishedWorkflowVideoGenerateResult

type GenerateMedia = () => Promise<PublishedWorkflowMediaGenerateResult>

export type PublishedWorkflowResolvedMediaSource = Readonly<{
  source: string
  actualVideoTokens?: number
  actualDurationSeconds?: number
  actualSeconds?: number
  downloadHeaders?: Record<string, string>
}>

export function firstPublishedWorkflowImageSource(result: PublishedWorkflowImageGenerateResult): string {
  if (!result.success) {
    throw new Error(result.error || 'published workflow image generation failed')
  }
  const firstUrl = Array.isArray(result.imageUrls)
    ? result.imageUrls.find((item) => typeof item === 'string' && item.trim())
    : undefined
  if (firstUrl) return firstUrl.trim()
  if (typeof result.imageUrl === 'string' && result.imageUrl.trim()) return result.imageUrl.trim()
  if (typeof result.imageBase64 === 'string' && result.imageBase64.trim()) {
    return `data:image/png;base64,${result.imageBase64.trim()}`
  }
  throw new Error('published workflow image generation returned no image output')
}

export function firstPublishedWorkflowVideoSource(result: PublishedWorkflowVideoGenerateResult): string {
  if (!result.success) {
    throw new Error(result.error || 'published workflow video generation failed')
  }
  if (typeof result.videoUrl === 'string' && result.videoUrl.trim()) return result.videoUrl.trim()
  throw new Error('published workflow video generation returned no video output')
}

export function firstPublishedWorkflowAudioSource(result: PublishedWorkflowAudioGenerateResult): string {
  if (!result.success) {
    throw new Error(result.error || 'published workflow audio generation failed')
  }
  if (typeof result.audioUrl === 'string' && result.audioUrl.trim()) return result.audioUrl.trim()
  if (typeof result.audioBase64 === 'string' && result.audioBase64.trim()) {
    return `data:audio/mpeg;base64,${result.audioBase64.trim()}`
  }
  throw new Error('published workflow audio generation returned no audio output')
}

function externalIdFromMediaResult(
  result: PublishedWorkflowMediaGenerateResult,
  mediaKind: string,
): string | null {
  if (!result.success) {
    throw new Error(result.error || `published workflow ${mediaKind} generation failed`)
  }
  const externalId = typeof result.externalId === 'string' ? result.externalId.trim() : ''
  if (externalId) return externalId
  if (result.async) {
    throw new Error(`published workflow media.generate ${mediaKind} async result returned no externalId`)
  }
  return null
}

function sourceFromPolledExternalJob(
  externalId: string,
  status: PublishedWorkflowMediaPollResult,
): PublishedWorkflowResolvedMediaSource {
  if (status.status === 'completed') {
    const source = status.resultUrl || status.imageUrl || status.videoUrl
      || status.audioUrl
    if (typeof source === 'string' && source.trim()) {
      return {
        source: source.trim(),
        ...(typeof status.actualVideoTokens === 'number'
          ? { actualVideoTokens: status.actualVideoTokens }
          : {}),
        ...(typeof status.actualDurationSeconds === 'number'
          ? { actualDurationSeconds: status.actualDurationSeconds }
          : {}),
        ...(typeof status.actualSeconds === 'number'
          ? { actualSeconds: status.actualSeconds }
          : {}),
        ...(status.downloadHeaders ? { downloadHeaders: status.downloadHeaders } : {}),
      }
    }
    throw ApplicationFailure.nonRetryable(
      `published workflow media external job completed without output: ${externalId}`,
      'PUBLISHED_WORKFLOW_MEDIA_EXTERNAL_JOB_EMPTY',
    )
  }
  if (status.status === 'failed') {
    throw ApplicationFailure.nonRetryable(
      status.error || `published workflow media external job failed: ${externalId}`,
      'PUBLISHED_WORKFLOW_MEDIA_EXTERNAL_JOB_FAILED',
    )
  }
  throw ApplicationFailure.retryable(
    `published workflow media external job pending: ${externalId}`,
    'PUBLISHED_WORKFLOW_MEDIA_EXTERNAL_JOB_PENDING',
  )
}

export async function resolvePublishedWorkflowMediaSource(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  mediaKind: string
  existingExternalJob: PublishedWorkflowMediaExternalJob | null
  versionHash: string
  generate: GenerateMedia
  firstSource: (result: PublishedWorkflowMediaGenerateResult) => string
  poll: PollPublishedWorkflowMediaExternalJob
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
}): Promise<PublishedWorkflowResolvedMediaSource> {
  const externalJob = params.existingExternalJob
  if (externalJob) {
    if (externalJob.mediaKind !== params.mediaKind) {
      throw new Error(`published workflow media external job kind mismatch: ${externalJob.mediaKind}`)
    }
    return sourceFromPolledExternalJob(
      externalJob.externalId,
      await params.poll({
        userId: params.workflow.userId,
        externalId: externalJob.externalId,
      }),
    )
  }

  const generated = await params.generate()
  const externalId = externalIdFromMediaResult(generated, params.mediaKind)
  if (!externalId) return { source: params.firstSource(generated) }

  await persistMediaExternalJob({
    workflow: params.workflow,
    step: params.step,
    versionHash: params.versionHash,
    mediaKind: params.mediaKind,
    externalId,
    createWorkflowArtifact: params.createWorkflowArtifact,
  })
  return sourceFromPolledExternalJob(
    externalId,
    await params.poll({
      userId: params.workflow.userId,
      externalId,
    }),
  )
}

export async function resolvePublishedWorkflowImageSource(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  mediaKind: string
  existingExternalJob: PublishedWorkflowMediaExternalJob | null
  versionHash: string
  generate: GenerateMedia
  poll: PollPublishedWorkflowMediaExternalJob
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
}): Promise<string> {
  const resolved = await resolvePublishedWorkflowMediaSource({
    ...params,
    firstSource: (result) => firstPublishedWorkflowImageSource(result as PublishedWorkflowImageGenerateResult),
  })
  return resolved.source
}
