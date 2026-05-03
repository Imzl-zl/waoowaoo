import { activityInfo } from '@temporalio/activity'
import { RUN_EVENT_TYPE } from '@/lib/run-runtime/types'
import {
  buildTemporalWorkflowCompletionPayload,
  buildTemporalWorkflowFailurePayload,
  buildTemporalWorkflowStepCompletedPayload,
  buildTemporalWorkflowStepFailurePayload,
  buildTemporalWorkflowStepStartedPayload,
  normalizeTemporalWorkflowStepDescriptor,
} from './contract'
import { publishTemporalRunLifecycleEvent } from './events'
import {
  type TemporalWorkflowFailureInput,
  type TemporalWorkflowRunInput,
  type TemporalWorkflowRunResult,
  type TemporalWorkflowStepDescriptor,
} from './types'
import { taskActivities } from './run-task'

export type TemporalActivities = typeof activities

const lifecycleActivities = {
  async recordWorkflowStarted(input: TemporalWorkflowRunInput) {
    const current = activityInfo()
    const event = await publishTemporalRunLifecycleEvent({
      workflow: input,
      eventType: RUN_EVENT_TYPE.RUN_START,
      payload: {
        activityId: current.activityId,
        temporalActivityType: 'recordWorkflowStarted',
      },
    })
    return {
      activityId: current.activityId,
      eventSeq: event.seq,
      runId: input.runId,
      workflowType: input.workflowType,
    }
  },
  async recordWorkflowStepStarted(
    input: TemporalWorkflowRunInput,
    stepInput?: TemporalWorkflowStepDescriptor | null,
  ) {
    const current = activityInfo()
    const step = normalizeTemporalWorkflowStepDescriptor(stepInput)
    const event = await publishTemporalRunLifecycleEvent({
      workflow: input,
      eventType: RUN_EVENT_TYPE.STEP_START,
      stepKey: step.stepKey,
      attempt: step.attempt,
      payload: buildTemporalWorkflowStepStartedPayload({
        activityId: current.activityId,
        step,
      }),
    })
    return {
      activityId: current.activityId,
      eventSeq: event.seq,
      runId: input.runId,
      workflowType: input.workflowType,
    }
  },
  async recordWorkflowStepCompleted(
    input: TemporalWorkflowRunInput,
    result: TemporalWorkflowRunResult,
    stepInput?: TemporalWorkflowStepDescriptor | null,
  ) {
    const current = activityInfo()
    const step = normalizeTemporalWorkflowStepDescriptor(stepInput)
    const event = await publishTemporalRunLifecycleEvent({
      workflow: input,
      eventType: RUN_EVENT_TYPE.STEP_COMPLETE,
      stepKey: step.stepKey,
      attempt: step.attempt,
      payload: buildTemporalWorkflowStepCompletedPayload({
        activityId: current.activityId,
        result,
        step,
      }),
    })
    return {
      activityId: current.activityId,
      eventSeq: event.seq,
      runId: input.runId,
      workflowType: input.workflowType,
    }
  },
  async recordWorkflowStepFailed(
    input: TemporalWorkflowRunInput,
    failure: TemporalWorkflowFailureInput,
    stepInput?: TemporalWorkflowStepDescriptor | null,
  ) {
    const current = activityInfo()
    const step = normalizeTemporalWorkflowStepDescriptor(stepInput)
    const event = await publishTemporalRunLifecycleEvent({
      workflow: input,
      eventType: RUN_EVENT_TYPE.STEP_ERROR,
      stepKey: step.stepKey,
      attempt: step.attempt,
      payload: buildTemporalWorkflowStepFailurePayload({
        activityId: current.activityId,
        failure,
        step,
      }),
    })
    return {
      activityId: current.activityId,
      eventSeq: event.seq,
      runId: input.runId,
      workflowType: input.workflowType,
    }
  },
  async recordWorkflowCompleted(
    input: TemporalWorkflowRunInput,
    result: TemporalWorkflowRunResult,
  ) {
    const current = activityInfo()
    const event = await publishTemporalRunLifecycleEvent({
      workflow: input,
      eventType: RUN_EVENT_TYPE.RUN_COMPLETE,
      payload: buildTemporalWorkflowCompletionPayload({
        activityId: current.activityId,
        result,
      }),
    })
    return {
      activityId: current.activityId,
      eventSeq: event.seq,
      runId: input.runId,
      workflowType: input.workflowType,
    }
  },
  async recordWorkflowFailed(
    input: TemporalWorkflowRunInput,
    failure: TemporalWorkflowFailureInput,
  ) {
    const current = activityInfo()
    const event = await publishTemporalRunLifecycleEvent({
      workflow: input,
      eventType: RUN_EVENT_TYPE.RUN_ERROR,
      payload: buildTemporalWorkflowFailurePayload({
        activityId: current.activityId,
        failure,
      }),
    })
    return {
      activityId: current.activityId,
      eventSeq: event.seq,
      runId: input.runId,
      workflowType: input.workflowType,
    }
  },
}

export const activities = {
  ...lifecycleActivities,
  ...taskActivities,
}
