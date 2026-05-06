import { proxyActivities } from '@temporalio/workflow'
import type { TemporalActivities } from './activities'
import type {
  TemporalTaskWorkflowResult,
  TemporalWorkflowFailureInput,
  TemporalWorkflowRunInput,
  TemporalWorkflowRunResult,
  TemporalWorkflowStepDescriptor,
} from './types'
import { buildTemporalWorkflowRunResult } from './contract'

const RUN_TASK_STEP: TemporalWorkflowStepDescriptor = {
  stepKey: 'run_task.execute',
  stepTitle: 'Run task execution',
  stepIndex: 1,
  stepTotal: 1,
  attempt: 1,
}

const activities = proxyActivities<TemporalActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
  },
})

export async function smokeWorkflow(input: TemporalWorkflowRunInput): Promise<TemporalWorkflowRunResult> {
  const started = await activities.recordWorkflowStarted(input)
  await activities.recordWorkflowStepStarted(input)
  const result = buildTemporalWorkflowRunResult(started)
  await activities.recordWorkflowStepCompleted(input, result)
  await activities.recordWorkflowCompleted(input, result)
  return result
}

const runTaskActivities = proxyActivities<TemporalActivities>({
  startToCloseTimeout: '2 hours',
  retry: {
    initialInterval: '2 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 5,
    nonRetryableErrorTypes: ['TASK_TERMINAL_FAILURE'],
  },
})

function buildWorkflowFailureInput(error: unknown): TemporalWorkflowFailureInput {
  if (error instanceof Error) {
    return {
      errorCode: error.name || 'TEMPORAL_RUN_TASK_FAILED',
      message: error.message || 'Temporal run task failed',
      retryable: true,
    }
  }
  return {
    errorCode: 'TEMPORAL_RUN_TASK_FAILED',
    message: typeof error === 'string' && error.trim() ? error.trim() : 'Temporal run task failed',
    retryable: true,
  }
}

export async function runTaskWorkflow(
  input: TemporalWorkflowRunInput,
): Promise<TemporalTaskWorkflowResult> {
  try {
    return await runTaskActivities.executeRunCentricTask(input)
  } catch (error) {
    const failure = buildWorkflowFailureInput(error)
    await runTaskActivities.recordWorkflowStepFailed(input, failure, RUN_TASK_STEP)
    await runTaskActivities.recordWorkflowFailed(input, failure)
    throw error
  }
}
