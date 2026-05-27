import type {
  CreatePublishedWorkflowArtifact,
  ListPublishedWorkflowArtifacts,
  PublishedWorkflowMediaDependencies,
  PublishedWorkflowVideoGenerateResult,
} from './published-workflow-activity-dependencies'
import {
  pollPublishedWorkflowMediaExternalJobDefault,
} from './published-workflow-media-defaults'
import {
  billPublishedWorkflowVideoDefault,
  generatePublishedWorkflowVideoDefault,
  resolvePublishedWorkflowVideoModelDefault,
  resolvePublishedWorkflowVideoOptionsDefault,
  resolvePublishedWorkflowVideoSourceImageDefault,
  storePublishedWorkflowVideoDefault,
} from './published-workflow-media-video-defaults'
import {
  persistMediaResult,
  publishedWorkflowMediaVersionHash,
  readCachedMediaResult,
  readMediaExternalJob,
} from './published-workflow-media-cache'
import {
  firstPublishedWorkflowVideoSource,
  resolvePublishedWorkflowMediaSource,
} from './published-workflow-media-external-job'
import {
  buildMediaPrompt,
  buildMediaStepResult,
  publishedWorkflowMediaBillingKey,
  requireConfigString,
} from './published-workflow-media-shared'
import { readPublishedWorkflowDependencyOutputs } from './published-workflow-step-context'
import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalPublishedWorkflowStepResult,
  TemporalWorkflowRunInput,
} from './types'

const VIDEO_COUNT = 1
const DEFAULT_VIDEO_BILLING_RESOLUTION = '720p'

function billingResolution(input: {
  options: Readonly<Record<string, unknown>>
  config: Readonly<Record<string, unknown>>
}): string {
  const optionResolution = input.options.resolution
  if (typeof optionResolution === 'string' && optionResolution.trim()) return optionResolution.trim()
  const configResolution = input.config.videoResolution
  if (typeof configResolution === 'string' && configResolution.trim()) return configResolution.trim()
  return DEFAULT_VIDEO_BILLING_RESOLUTION
}

export async function executePublishedWorkflowVideoMediaStep(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  context: TemporalPublishedWorkflowStepContext
  activityId: string
  activityAttempt: number
  mediaKind: string
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
  listWorkflowArtifacts?: ListPublishedWorkflowArtifacts
  media?: PublishedWorkflowMediaDependencies
}): Promise<TemporalPublishedWorkflowStepResult> {
  const prompt = requireConfigString(params.step.config, 'prompt')
  const dependencies = readPublishedWorkflowDependencyOutputs(params.step, params.context)
  const modelSelection = await (
    params.media?.resolveVideoModel || resolvePublishedWorkflowVideoModelDefault
  )({ workflow: params.workflow, step: params.step })
  const options = await (
    params.media?.resolveVideoOptions || resolvePublishedWorkflowVideoOptionsDefault
  )({ workflow: params.workflow, step: params.step, model: modelSelection.model })
  const renderedPrompt = buildMediaPrompt({ prompt, dependencies })
  const versionHash = publishedWorkflowMediaVersionHash({
    nodeType: params.step.nodeType,
    stepKey: params.step.stepKey,
    config: params.step.config,
    dependencies,
    modelSelection,
    options,
    renderedPrompt,
  })
  const cached = await readCachedMediaResult({
    workflow: params.workflow,
    step: params.step,
    activityId: params.activityId,
    versionHash,
    listWorkflowArtifacts: params.listWorkflowArtifacts,
  })
  if (cached) return cached
  const existingExternalJob = await readMediaExternalJob({
    workflow: params.workflow,
    step: params.step,
    versionHash,
    listWorkflowArtifacts: params.listWorkflowArtifacts,
  })
  const sourceImage = await (
    params.media?.resolveVideoSourceImage || resolvePublishedWorkflowVideoSourceImageDefault
  )({ step: params.step, context: params.context })

  const generate = params.media?.generateVideo || generatePublishedWorkflowVideoDefault
  const poll = params.media?.pollExternalJob || pollPublishedWorkflowMediaExternalJobDefault
  const bill = params.media?.billVideo || billPublishedWorkflowVideoDefault
  const store = params.media?.storeVideo || storePublishedWorkflowVideoDefault
  const stored = await bill({
    userId: params.workflow.userId,
    model: modelSelection.model,
    resolution: billingResolution({ options, config: params.step.config }),
    maxCount: VIDEO_COUNT,
    projectId: params.workflow.projectId,
    action: 'published_workflow_media_generate_video',
    billingKey: publishedWorkflowMediaBillingKey({
      runId: params.workflow.runId,
      stepKey: params.step.stepKey,
      activityAttempt: params.activityAttempt,
    }),
    metadata: {
      workflowType: params.workflow.workflowType,
      workflowDefinitionVersionId: params.workflow.targetId,
      nodeId: params.step.nodeId,
      nodeType: params.step.nodeType,
      stepKey: params.step.stepKey,
      mediaKind: params.mediaKind,
      modelSlot: modelSelection.modelSlot,
      sourceStepKey: sourceImage.sourceStepKey,
      sourceStorageKey: sourceImage.storageKey || null,
      activityAttempt: params.activityAttempt,
      ...options,
    },
    execute: async () => {
      const resolved = await resolvePublishedWorkflowMediaSource({
        workflow: params.workflow,
        step: params.step,
        mediaKind: params.mediaKind,
        existingExternalJob,
        versionHash,
        generate: async () => await generate({
          userId: params.workflow.userId,
          model: modelSelection.model,
          prompt: renderedPrompt,
          imageUrl: sourceImage.imageUrl,
          options,
        }),
        firstSource: (result) => firstPublishedWorkflowVideoSource(result as PublishedWorkflowVideoGenerateResult),
        poll,
        createWorkflowArtifact: params.createWorkflowArtifact,
      })
      const video = await store({
        workflow: params.workflow,
        step: params.step,
        source: resolved.source,
        downloadHeaders: resolved.downloadHeaders,
      })
      return {
        ...video,
        ...(typeof resolved.actualVideoTokens === 'number'
          ? { actualVideoTokens: resolved.actualVideoTokens }
          : {}),
      }
    },
  })

  const result = buildMediaStepResult({
    step: params.step,
    activityId: params.activityId,
    text: stored.mediaRef.url,
    artifactPayload: {
      mediaKind: params.mediaKind,
      model: modelSelection.model,
      modelSlot: modelSelection.modelSlot,
      prompt: renderedPrompt,
      options,
      sourceStepKey: sourceImage.sourceStepKey,
      sourceStorageKey: sourceImage.storageKey || null,
      storageKey: stored.storageKey,
      media: stored.mediaRef,
      ...(typeof stored.actualVideoTokens === 'number'
        ? { actualVideoTokens: stored.actualVideoTokens }
        : {}),
    },
  })
  await persistMediaResult({
    workflow: params.workflow,
    step: params.step,
    versionHash,
    result,
    createWorkflowArtifact: params.createWorkflowArtifact,
  })
  return result
}
