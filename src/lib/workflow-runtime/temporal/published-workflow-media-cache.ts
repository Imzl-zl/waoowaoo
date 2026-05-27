import { createArtifact, listArtifacts } from '@/lib/run-runtime/service'
import { publishedWorkflowVersionHash } from './published-workflow-cache-hash'
import type {
  CreatePublishedWorkflowArtifact,
  ListPublishedWorkflowArtifacts,
} from './published-workflow-activity-dependencies'
import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepResult,
  TemporalWorkflowRunInput,
} from './types'

export const MEDIA_RESULT_ARTIFACT_TYPE = 'workflow.media.result'
export const MEDIA_EXTERNAL_JOB_ARTIFACT_TYPE = 'workflow.media.external-job'

export type PublishedWorkflowMediaExternalJob = Readonly<{
  externalId: string
  mediaKind: string
}>

export function publishedWorkflowMediaVersionHash(value: unknown): string {
  return publishedWorkflowVersionHash(value)
}

function resultFromCachedPayload(
  step: TemporalPublishedWorkflowStep,
  activityId: string,
  payload: unknown,
): TemporalPublishedWorkflowStepResult | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const result = (payload as Record<string, unknown>).result
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null
  const record = result as Record<string, unknown>
  if (record.stepKey !== step.stepKey || record.nodeId !== step.nodeId || record.nodeType !== step.nodeType) return null
  if (record.status !== 'completed' || typeof record.text !== 'string') return null
  return {
    stepKey: step.stepKey,
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    status: 'completed',
    activityId,
    text: record.text,
    artifactPayload: record.artifactPayload,
  }
}

export async function readCachedMediaResult(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  activityId: string
  versionHash: string
  listWorkflowArtifacts?: ListPublishedWorkflowArtifacts
}): Promise<TemporalPublishedWorkflowStepResult | null> {
  const reader = params.listWorkflowArtifacts || listArtifacts
  const artifacts = await reader({
    runId: params.workflow.runId,
    stepKey: params.step.stepKey,
    artifactType: MEDIA_RESULT_ARTIFACT_TYPE,
    refId: params.step.stepKey,
    limit: 1,
  })
  const artifact = artifacts[0]
  if (!artifact || artifact.versionHash !== params.versionHash) return null
  return resultFromCachedPayload(params.step, params.activityId, artifact.payload)
}

export async function persistMediaResult(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  versionHash: string
  result: TemporalPublishedWorkflowStepResult
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
}) {
  const writer = params.createWorkflowArtifact || createArtifact
  await writer({
    runId: params.workflow.runId,
    stepKey: params.step.stepKey,
    artifactType: MEDIA_RESULT_ARTIFACT_TYPE,
    refId: params.step.stepKey,
    versionHash: params.versionHash,
    payload: { result: params.result },
  })
}

function externalJobFromPayload(payload: unknown): PublishedWorkflowMediaExternalJob | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const externalId = (payload as Record<string, unknown>).externalId
  const mediaKind = (payload as Record<string, unknown>).mediaKind
  if (typeof externalId !== 'string' || !externalId.trim()) return null
  if (typeof mediaKind !== 'string' || !mediaKind.trim()) return null
  return {
    externalId: externalId.trim(),
    mediaKind: mediaKind.trim(),
  }
}

export async function readMediaExternalJob(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  versionHash: string
  listWorkflowArtifacts?: ListPublishedWorkflowArtifacts
}): Promise<PublishedWorkflowMediaExternalJob | null> {
  const reader = params.listWorkflowArtifacts || listArtifacts
  const artifacts = await reader({
    runId: params.workflow.runId,
    stepKey: params.step.stepKey,
    artifactType: MEDIA_EXTERNAL_JOB_ARTIFACT_TYPE,
    refId: params.step.stepKey,
    limit: 1,
  })
  const artifact = artifacts[0]
  if (!artifact || artifact.versionHash !== params.versionHash) return null
  return externalJobFromPayload(artifact.payload)
}

export async function persistMediaExternalJob(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  versionHash: string
  mediaKind: string
  externalId: string
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
}) {
  const externalId = params.externalId.trim()
  if (!externalId) throw new Error('published workflow media externalId is required')
  const writer = params.createWorkflowArtifact || createArtifact
  await writer({
    runId: params.workflow.runId,
    stepKey: params.step.stepKey,
    artifactType: MEDIA_EXTERNAL_JOB_ARTIFACT_TYPE,
    refId: params.step.stepKey,
    versionHash: params.versionHash,
    payload: {
      mediaKind: params.mediaKind,
      externalId,
    },
  })
}
