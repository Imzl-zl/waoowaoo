import type {
  CreatePublishedWorkflowArtifact,
  ListPublishedWorkflowArtifacts,
  PublishedWorkflowMediaDependencies,
} from './published-workflow-activity-dependencies'
import { requireConfigString } from './published-workflow-media-shared'
import { executePublishedWorkflowAudioMediaStep } from './published-workflow-media-audio'
import { executePublishedWorkflowImageMediaStep } from './published-workflow-media-image'
import { executePublishedWorkflowVideoMediaStep } from './published-workflow-media-video'
import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalPublishedWorkflowStepResult,
  TemporalWorkflowRunInput,
} from './types'

export async function executePublishedWorkflowMediaStep(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  context: TemporalPublishedWorkflowStepContext
  activityId: string
  activityAttempt: number
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
  listWorkflowArtifacts?: ListPublishedWorkflowArtifacts
  media?: PublishedWorkflowMediaDependencies
}): Promise<TemporalPublishedWorkflowStepResult> {
  const mediaKind = requireConfigString(params.step.config, 'mediaKind')
  if (mediaKind === 'image') {
    return await executePublishedWorkflowImageMediaStep({ ...params, mediaKind })
  }
  if (mediaKind === 'video') {
    return await executePublishedWorkflowVideoMediaStep({ ...params, mediaKind })
  }
  if (mediaKind === 'audio') {
    return await executePublishedWorkflowAudioMediaStep({ ...params, mediaKind })
  }
  throw new Error(`published workflow media.generate does not support ${mediaKind}`)
}
