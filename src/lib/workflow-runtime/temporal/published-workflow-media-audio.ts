import type {
  CreatePublishedWorkflowArtifact,
  ListPublishedWorkflowArtifacts,
  PublishedWorkflowAudioGenerateResult,
  PublishedWorkflowMediaDependencies,
} from './published-workflow-activity-dependencies'
import {
  pollPublishedWorkflowMediaExternalJobDefault,
} from './published-workflow-media-defaults'
import {
  billPublishedWorkflowAudioDefault,
  generatePublishedWorkflowAudioDefault,
  resolvePublishedWorkflowAudioModelDefault,
  resolvePublishedWorkflowAudioOptionsDefault,
  storePublishedWorkflowAudioDefault,
} from './published-workflow-media-audio-defaults'
import {
  persistMediaResult,
  publishedWorkflowMediaVersionHash,
  readCachedMediaResult,
  readMediaExternalJob,
} from './published-workflow-media-cache'
import {
  firstPublishedWorkflowAudioSource,
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

function audioActualDurationSeconds(input: {
  generated?: PublishedWorkflowAudioGenerateResult
  resolved?: {
    actualDurationSeconds?: number
    actualSeconds?: number
  }
}): number | undefined {
  const value = input.resolved?.actualDurationSeconds
    ?? input.resolved?.actualSeconds
    ?? input.generated?.actualDurationSeconds
    ?? input.generated?.actualSeconds
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export async function executePublishedWorkflowAudioMediaStep(params: {
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
  const renderedText = buildMediaPrompt({ prompt, dependencies })
  const modelSelection = await (
    params.media?.resolveAudioModel || resolvePublishedWorkflowAudioModelDefault
  )({ workflow: params.workflow, step: params.step })
  const options = await (
    params.media?.resolveAudioOptions || resolvePublishedWorkflowAudioOptionsDefault
  )({
    workflow: params.workflow,
    step: params.step,
    model: modelSelection.model,
    renderedText,
  })
  const versionHash = publishedWorkflowMediaVersionHash({
    nodeType: params.step.nodeType,
    stepKey: params.step.stepKey,
    config: params.step.config,
    dependencies,
    modelSelection,
    options,
    renderedText,
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

  const generate = params.media?.generateAudio || generatePublishedWorkflowAudioDefault
  const poll = params.media?.pollExternalJob || pollPublishedWorkflowMediaExternalJobDefault
  const bill = params.media?.billAudio || billPublishedWorkflowAudioDefault
  const store = params.media?.storeAudio || storePublishedWorkflowAudioDefault
  const stored = await bill({
    userId: params.workflow.userId,
    model: modelSelection.model,
    maxFreezeSeconds: options.maxFreezeSeconds,
    projectId: params.workflow.projectId,
    action: 'published_workflow_media_generate_audio',
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
      voice: options.voice,
      rate: options.rate,
      maxFreezeSeconds: options.maxFreezeSeconds,
      activityAttempt: params.activityAttempt,
    },
    execute: async () => {
      let generated: PublishedWorkflowAudioGenerateResult | undefined
      const resolved = await resolvePublishedWorkflowMediaSource({
        workflow: params.workflow,
        step: params.step,
        mediaKind: params.mediaKind,
        existingExternalJob,
        versionHash,
        generate: async () => {
          generated = await generate({
            userId: params.workflow.userId,
            model: modelSelection.model,
            text: renderedText,
            options,
          })
          return generated
        },
        firstSource: (result) => firstPublishedWorkflowAudioSource(result as PublishedWorkflowAudioGenerateResult),
        poll,
        createWorkflowArtifact: params.createWorkflowArtifact,
      })
      const audio = await store({
        workflow: params.workflow,
        step: params.step,
        source: resolved.source,
        downloadHeaders: resolved.downloadHeaders,
      })
      const actualDurationSeconds = audioActualDurationSeconds({ generated, resolved })
      return {
        ...audio,
        ...(actualDurationSeconds !== undefined ? { actualDurationSeconds } : {}),
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
      text: renderedText,
      voice: options.voice,
      rate: options.rate,
      maxFreezeSeconds: options.maxFreezeSeconds,
      storageKey: stored.storageKey,
      media: stored.mediaRef,
      ...(typeof stored.actualDurationSeconds === 'number'
        ? { actualDurationSeconds: stored.actualDurationSeconds }
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
