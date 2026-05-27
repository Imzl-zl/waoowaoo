import type {
  CreatePublishedWorkflowArtifact,
  ListPublishedWorkflowArtifacts,
  PublishedWorkflowMediaDependencies,
} from './published-workflow-activity-dependencies'
import {
  billPublishedWorkflowImageDefault,
  generatePublishedWorkflowImageDefault,
  pollPublishedWorkflowMediaExternalJobDefault,
  resolvePublishedWorkflowImageModelDefault,
  resolvePublishedWorkflowImageOptionsDefault,
  storePublishedWorkflowImageDefault,
} from './published-workflow-media-defaults'
import {
  persistMediaResult,
  publishedWorkflowMediaVersionHash,
  readCachedMediaResult,
  readMediaExternalJob,
} from './published-workflow-media-cache'
import { resolvePublishedWorkflowImageSource } from './published-workflow-media-external-job'
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

const IMAGE_COUNT = 1

export async function executePublishedWorkflowImageMediaStep(params: {
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
    params.media?.resolveImageModel || resolvePublishedWorkflowImageModelDefault
  )({ workflow: params.workflow, step: params.step })
  const options = await (
    params.media?.resolveImageOptions || resolvePublishedWorkflowImageOptionsDefault
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

  const generate = params.media?.generateImage || generatePublishedWorkflowImageDefault
  const poll = params.media?.pollExternalJob || pollPublishedWorkflowMediaExternalJobDefault
  const bill = params.media?.billImage || billPublishedWorkflowImageDefault
  const store = params.media?.storeImage || storePublishedWorkflowImageDefault
  const stored = await bill({
    userId: params.workflow.userId,
    model: modelSelection.model,
    count: IMAGE_COUNT,
    projectId: params.workflow.projectId,
    action: 'published_workflow_media_generate_image',
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
      activityAttempt: params.activityAttempt,
      ...options,
    },
    execute: async () => {
      const source = await resolvePublishedWorkflowImageSource({
        workflow: params.workflow,
        step: params.step,
        mediaKind: params.mediaKind,
        existingExternalJob,
        versionHash,
        generate: async () => await generate({
          userId: params.workflow.userId,
          model: modelSelection.model,
          prompt: renderedPrompt,
          options,
        }),
        poll,
        createWorkflowArtifact: params.createWorkflowArtifact,
      })
      return await store({
        workflow: params.workflow,
        step: params.step,
        source,
      })
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
      storageKey: stored.storageKey,
      media: stored.mediaRef,
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
