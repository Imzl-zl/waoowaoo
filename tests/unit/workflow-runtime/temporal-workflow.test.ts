import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildTemporalWorkflowCompletionPayload,
  buildTemporalWorkflowFailurePayload,
  buildTemporalWorkflowRunResult,
  buildTemporalWorkflowStepCompletedPayload,
  buildTemporalWorkflowStepFailurePayload,
  buildTemporalWorkflowStepStartedPayload,
} from '@/lib/workflow-runtime/temporal/contract'
import { runTaskWorkflow } from '@/lib/workflow-runtime/temporal/workflows'
import {
  TEMPORAL_SMOKE_STEP,
  TEMPORAL_WORKFLOW_TYPE,
  type TemporalTaskWorkflowResult,
  type TemporalWorkflowRunInput,
} from '@/lib/workflow-runtime/temporal/types'

const temporalActivitiesMock = vi.hoisted(() => ({
  recordWorkflowStarted: vi.fn(),
  recordWorkflowStepStarted: vi.fn(),
  recordWorkflowStepCompleted: vi.fn(),
  recordWorkflowCompleted: vi.fn(),
  executeRunCentricTask: vi.fn(),
  recordWorkflowStepFailed: vi.fn(),
  recordWorkflowFailed: vi.fn(),
}))

vi.mock('@temporalio/workflow', () => ({
  proxyActivities: vi.fn(() => temporalActivitiesMock),
}))

beforeEach(() => {
  temporalActivitiesMock.recordWorkflowStarted.mockReset()
  temporalActivitiesMock.recordWorkflowStepStarted.mockReset()
  temporalActivitiesMock.recordWorkflowStepCompleted.mockReset()
  temporalActivitiesMock.recordWorkflowCompleted.mockReset()
  temporalActivitiesMock.executeRunCentricTask.mockReset()
  temporalActivitiesMock.recordWorkflowStepFailed.mockReset()
  temporalActivitiesMock.recordWorkflowFailed.mockReset()
})

function buildRunTaskWorkflowInput(): TemporalWorkflowRunInput {
  return {
    runId: 'run-1',
    workflowType: 'story_to_script_run',
    projectId: 'project-1',
    userId: 'user-1',
    taskId: 'task-1',
    targetType: 'task',
    targetId: 'task-1',
  }
}

const RUN_TASK_FAILURE_STEP = {
  stepKey: 'run_task.execute',
  stepTitle: 'Run task execution',
  stepIndex: 1,
  stepTotal: 1,
  attempt: 1,
}

describe('buildTemporalWorkflowRunResult', () => {
  it('exposes the real run task workflow type', () => {
    expect(TEMPORAL_WORKFLOW_TYPE.RUN_TASK).toBe('runTaskWorkflow')
  })

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

describe('runTaskWorkflow', () => {
  it('returns the run-centric task result without writing failure lifecycle on success', async () => {
    const input = buildRunTaskWorkflowInput()
    const result: TemporalTaskWorkflowResult = {
      runId: input.runId,
      workflowType: input.workflowType,
      taskId: 'task-1',
      taskType: 'story_to_script_run',
      status: 'completed',
      activityId: 'activity-1',
    }
    temporalActivitiesMock.executeRunCentricTask.mockResolvedValue(result)

    await expect(runTaskWorkflow(input)).resolves.toBe(result)

    expect(temporalActivitiesMock.executeRunCentricTask).toHaveBeenCalledWith(input)
    expect(temporalActivitiesMock.recordWorkflowStepFailed).not.toHaveBeenCalled()
    expect(temporalActivitiesMock.recordWorkflowFailed).not.toHaveBeenCalled()
  })

  it('records step and run failure lifecycle before rethrowing the original task error', async () => {
    const input = buildRunTaskWorkflowInput()
    const error = new Error('activity failed')
    const failure = {
      errorCode: 'Error',
      message: 'activity failed',
      retryable: true,
    }
    temporalActivitiesMock.executeRunCentricTask.mockRejectedValue(error)

    await expect(runTaskWorkflow(input)).rejects.toBe(error)

    expect(temporalActivitiesMock.recordWorkflowStepFailed).toHaveBeenCalledWith(
      input,
      failure,
      RUN_TASK_FAILURE_STEP,
    )
    expect(temporalActivitiesMock.recordWorkflowFailed).toHaveBeenCalledWith(input, failure)
  })
})
