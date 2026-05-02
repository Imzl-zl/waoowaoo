import { describe, expect, it } from 'vitest'
import {
  buildTemporalWorkflowCompletionPayload,
  buildTemporalWorkflowFailurePayload,
  buildTemporalWorkflowRunResult,
  buildTemporalWorkflowStepCompletedPayload,
  buildTemporalWorkflowStepFailurePayload,
  buildTemporalWorkflowStepStartedPayload,
} from '@/lib/workflow-runtime/temporal/contract'
import { TEMPORAL_SMOKE_STEP } from '@/lib/workflow-runtime/temporal/types'

describe('buildTemporalWorkflowRunResult', () => {
  it('builds the stable product-facing Temporal smoke result', () => {
    expect(buildTemporalWorkflowRunResult({
      runId: 'run-1',
      workflowType: 'smoke',
      activityId: 'activity-1',
    })).toEqual({
      runId: 'run-1',
      workflowType: 'smoke',
      status: 'completed',
      activityId: 'activity-1',
    })
  })

  it('exposes invalid workflow result boundaries', () => {
    expect(() => buildTemporalWorkflowRunResult({
      runId: '',
      workflowType: 'smoke',
      activityId: 'activity-1',
    })).toThrow('runId is required')
  })

  it('builds completion payload without changing the workflow result contract', () => {
    const result = buildTemporalWorkflowRunResult({
      runId: 'run-1',
      workflowType: 'smoke',
      activityId: 'start-activity-1',
    })

    expect(buildTemporalWorkflowCompletionPayload({
      activityId: 'complete-activity-1',
      result,
    })).toEqual({
      temporalActivityType: 'recordWorkflowCompleted',
      activityId: 'complete-activity-1',
      workflowResult: result,
    })
  })

  it('builds smoke step lifecycle payloads for run-runtime projection', () => {
    const result = buildTemporalWorkflowRunResult({
      runId: 'run-1',
      workflowType: 'smoke',
      activityId: 'start-activity-1',
    })

    expect(buildTemporalWorkflowStepStartedPayload({
      activityId: 'step-start-activity-1',
    })).toEqual({
      temporalActivityType: 'recordWorkflowStepStarted',
      activityId: 'step-start-activity-1',
      stepKey: TEMPORAL_SMOKE_STEP.KEY,
      stepTitle: TEMPORAL_SMOKE_STEP.TITLE,
      stepIndex: TEMPORAL_SMOKE_STEP.INDEX,
      stepTotal: TEMPORAL_SMOKE_STEP.TOTAL,
      stepAttempt: TEMPORAL_SMOKE_STEP.ATTEMPT,
    })
    expect(buildTemporalWorkflowStepCompletedPayload({
      activityId: 'step-complete-activity-1',
      result,
    })).toEqual({
      temporalActivityType: 'recordWorkflowStepCompleted',
      activityId: 'step-complete-activity-1',
      stepKey: TEMPORAL_SMOKE_STEP.KEY,
      stepTitle: TEMPORAL_SMOKE_STEP.TITLE,
      stepIndex: TEMPORAL_SMOKE_STEP.INDEX,
      stepTotal: TEMPORAL_SMOKE_STEP.TOTAL,
      stepAttempt: TEMPORAL_SMOKE_STEP.ATTEMPT,
      text: 'Temporal smoke workflow completed',
      artifactPayload: result,
    })
  })

  it('builds generic step lifecycle payloads from an explicit descriptor', () => {
    const step = {
      stepKey: 'analyze_characters',
      stepTitle: 'Analyze characters',
      stepIndex: 2,
      stepTotal: 6,
      attempt: 3,
    }

    expect(buildTemporalWorkflowStepStartedPayload({
      activityId: 'step-start-activity-2',
      step,
    })).toEqual({
      temporalActivityType: 'recordWorkflowStepStarted',
      activityId: 'step-start-activity-2',
      stepKey: 'analyze_characters',
      stepTitle: 'Analyze characters',
      stepIndex: 2,
      stepTotal: 6,
      stepAttempt: 3,
    })
  })

  it('builds failure payloads for run-runtime projection', () => {
    const failure = {
      errorCode: 'TEMPORAL_ACTIVITY_FAILED',
      message: 'Temporal activity failed',
      retryable: false,
    }

    expect(buildTemporalWorkflowFailurePayload({
      activityId: 'run-failed-activity-1',
      failure,
    })).toEqual({
      temporalActivityType: 'recordWorkflowFailed',
      activityId: 'run-failed-activity-1',
      errorCode: 'TEMPORAL_ACTIVITY_FAILED',
      message: 'Temporal activity failed',
      errorMessage: 'Temporal activity failed',
      retryable: false,
    })
    expect(buildTemporalWorkflowStepFailurePayload({
      activityId: 'step-failed-activity-1',
      failure,
    })).toEqual({
      temporalActivityType: 'recordWorkflowStepFailed',
      activityId: 'step-failed-activity-1',
      stepKey: TEMPORAL_SMOKE_STEP.KEY,
      stepTitle: TEMPORAL_SMOKE_STEP.TITLE,
      stepIndex: TEMPORAL_SMOKE_STEP.INDEX,
      stepTotal: TEMPORAL_SMOKE_STEP.TOTAL,
      stepAttempt: TEMPORAL_SMOKE_STEP.ATTEMPT,
      errorCode: 'TEMPORAL_ACTIVITY_FAILED',
      message: 'Temporal activity failed',
      errorMessage: 'Temporal activity failed',
      retryable: false,
      artifactPayload: {
        errorCode: 'TEMPORAL_ACTIVITY_FAILED',
        message: 'Temporal activity failed',
        errorMessage: 'Temporal activity failed',
        retryable: false,
      },
    })
  })

  it('exposes invalid workflow failure boundaries', () => {
    expect(() => buildTemporalWorkflowFailurePayload({
      activityId: 'run-failed-activity-1',
      failure: {
        errorCode: '',
        message: 'Temporal activity failed',
      },
    })).toThrow('errorCode is required')
    expect(() => buildTemporalWorkflowStepFailurePayload({
      activityId: 'step-failed-activity-1',
      failure: {
        errorCode: 'TEMPORAL_ACTIVITY_FAILED',
        message: ' ',
      },
    })).toThrow('message is required')
  })

  it('exposes invalid step descriptor boundaries', () => {
    expect(() => buildTemporalWorkflowStepStartedPayload({
      activityId: 'step-start-activity-1',
      step: {
        stepKey: '',
        stepTitle: 'Analyze characters',
        stepIndex: 1,
        stepTotal: 1,
        attempt: 1,
      },
    })).toThrow('stepKey is required')
    expect(() => buildTemporalWorkflowStepStartedPayload({
      activityId: 'step-start-activity-1',
      step: {
        stepKey: 'analyze_characters',
        stepTitle: 'Analyze characters',
        stepIndex: 2,
        stepTotal: 1,
        attempt: 1,
      },
    })).toThrow('stepTotal must be greater than or equal to stepIndex')
  })
})
