import { proxyActivities } from '@temporalio/workflow'
import type { TemporalActivities } from './activities'
import type {
  TemporalTaskWorkflowResult,
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalPublishedWorkflowStepResult,
  TemporalWorkflowFailureInput,
  TemporalWorkflowRunInput,
  TemporalWorkflowRunResult,
  TemporalWorkflowStepDescriptor,
} from './types'
import {
  buildTemporalWorkflowRunResult,
  normalizeTemporalWorkflowStepDescriptor,
} from './contract'
import { TEMPORAL_RUN_TASK_FAILURE_STEP } from './run-task-contract'
import { pickPublishedWorkflowStepContext } from './published-workflow-step-context'

const activities = proxyActivities<TemporalActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
  },
})

const publishedWorkflowStepActivities = proxyActivities<TemporalActivities>({
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '10 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 12,
  },
})

function readSmokeWorkflowSteps(input: TemporalWorkflowRunInput) {
  const value = input.payload?.temporalSteps
  if (!Array.isArray(value) || value.length === 0) {
    return [normalizeTemporalWorkflowStepDescriptor(null)]
  }
  return value.map((step) => (
    normalizeTemporalWorkflowStepDescriptor(step as TemporalWorkflowStepDescriptor)
  ))
}

function readPublishedWorkflowSteps(input: TemporalWorkflowRunInput): TemporalPublishedWorkflowStep[] {
  const value = input.payload?.publishedWorkflowSteps
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('publishedWorkflowSteps is required')
  }
  return value as TemporalPublishedWorkflowStep[]
}

export async function smokeWorkflow(input: TemporalWorkflowRunInput): Promise<TemporalWorkflowRunResult> {
  const steps = readSmokeWorkflowSteps(input)
  const started = await activities.recordWorkflowStarted(input)
  for (const step of steps) {
    await activities.recordWorkflowStepStarted(input, step)
  }
  const result = buildTemporalWorkflowRunResult(started)
  for (const step of steps) {
    await activities.recordWorkflowStepCompleted(input, result, step)
  }
  await activities.recordWorkflowCompleted(input, result)
  return result
}

export async function publishedWorkflow(input: TemporalWorkflowRunInput): Promise<TemporalWorkflowRunResult> {
  const steps = readPublishedWorkflowSteps(input)
  const started = await activities.recordWorkflowStarted(input)
  let context: TemporalPublishedWorkflowStepContext = {}
  let activeStep: TemporalPublishedWorkflowStep | null = null

  try {
    for (const step of steps) {
      activeStep = step
      const dependencyContext = pickPublishedWorkflowStepContext(step, context)
      await activities.recordWorkflowStepStarted(input, step.temporalStep)
      const result: TemporalPublishedWorkflowStepResult = await publishedWorkflowStepActivities.executePublishedWorkflowStep(
        input,
        step,
        dependencyContext,
      )
      context = { ...context, [step.stepKey]: result }
      await activities.recordWorkflowStepCompleted(input, result, step.temporalStep)
      activeStep = null
    }

    const result = buildTemporalWorkflowRunResult(started)
    await activities.recordWorkflowCompleted(input, result)
    return result
  } catch (error) {
    const failure = buildWorkflowFailureInput(error)
    if (activeStep) {
      await activities.recordWorkflowStepFailed(input, failure, activeStep.temporalStep)
    }
    await activities.recordWorkflowFailed(input, failure)
    throw error
  }
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
    await runTaskActivities.recordWorkflowStepFailed(input, failure, TEMPORAL_RUN_TASK_FAILURE_STEP)
    await runTaskActivities.recordWorkflowFailed(input, failure)
    throw error
  }
}
