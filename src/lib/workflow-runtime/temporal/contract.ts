import type {
  TemporalWorkflowCompletionPayload,
  TemporalWorkflowFailureDetails,
  TemporalWorkflowFailureInput,
  TemporalWorkflowFailurePayload,
  TemporalWorkflowRunInput,
  TemporalWorkflowRunResult,
  TemporalWorkflowStepDescriptor,
  TemporalWorkflowStepFailurePayload,
  TemporalWorkflowStepPayload,
} from './types'
import { TEMPORAL_SMOKE_STEP } from './types'

type RequiredWorkflowInputField = 'runId' | 'workflowType' | 'projectId' | 'userId' | 'targetType' | 'targetId'
type TemporalWorkflowStepActivityType =
  | TemporalWorkflowStepPayload['temporalActivityType']
  | TemporalWorkflowStepFailurePayload['temporalActivityType']

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${label} is required`)
  }
  return trimmed
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizePayload(value: TemporalWorkflowRunInput['payload']) {
  if (value === undefined || value === null) return null
  if (Array.isArray(value) || typeof value !== 'object') {
    throw new Error('payload must be an object when provided')
  }
  return value
}

function requirePositiveInt(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`)
  }
  return Math.floor(value)
}

function normalizeOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean when provided`)
  }
  return value
}

export function normalizeTemporalWorkflowRunInput(
  input: TemporalWorkflowRunInput,
): TemporalWorkflowRunInput {
  const requiredFields: RequiredWorkflowInputField[] = [
    'runId',
    'workflowType',
    'projectId',
    'userId',
    'targetType',
    'targetId',
  ]
  const required = Object.fromEntries(
    requiredFields.map((field) => [field, requireTrimmed(input[field], field)]),
  ) as Pick<TemporalWorkflowRunInput, RequiredWorkflowInputField>

  return {
    ...input,
    ...required,
    episodeId: normalizeOptionalString(input.episodeId),
    taskId: normalizeOptionalString(input.taskId),
    payload: normalizePayload(input.payload),
  }
}

export function buildTemporalWorkflowRunResult(input: {
  runId: string
  workflowType: string
  activityId: string
}): TemporalWorkflowRunResult {
  if (!input.runId.trim()) {
    throw new Error('runId is required')
  }
  if (!input.workflowType.trim()) {
    throw new Error('workflowType is required')
  }
  if (!input.activityId.trim()) {
    throw new Error('activityId is required')
  }
  return {
    runId: input.runId,
    workflowType: input.workflowType,
    status: 'completed',
    activityId: input.activityId,
  }
}

export function buildTemporalWorkflowCompletionPayload(input: {
  activityId: string
  result: TemporalWorkflowRunResult
}): TemporalWorkflowCompletionPayload {
  if (!input.activityId.trim()) {
    throw new Error('activityId is required')
  }
  return {
    temporalActivityType: 'recordWorkflowCompleted',
    activityId: input.activityId,
    workflowResult: input.result,
  }
}

function normalizeFailureDetails(input: TemporalWorkflowFailureInput): TemporalWorkflowFailureDetails {
  const message = requireTrimmed(input.message, 'message')
  const details = {
    errorCode: requireTrimmed(input.errorCode, 'errorCode'),
    message,
    errorMessage: message,
  }
  const retryable = normalizeOptionalBoolean(input.retryable, 'retryable')
  return retryable === undefined ? details : { ...details, retryable }
}

export function normalizeTemporalWorkflowStepDescriptor(
  input: TemporalWorkflowStepDescriptor | null | undefined,
): TemporalWorkflowStepDescriptor {
  const source = input || {
    stepKey: TEMPORAL_SMOKE_STEP.KEY,
    stepTitle: TEMPORAL_SMOKE_STEP.TITLE,
    stepIndex: TEMPORAL_SMOKE_STEP.INDEX,
    stepTotal: TEMPORAL_SMOKE_STEP.TOTAL,
    attempt: TEMPORAL_SMOKE_STEP.ATTEMPT,
  }
  const stepIndex = requirePositiveInt(source.stepIndex, 'stepIndex')
  const stepTotal = requirePositiveInt(source.stepTotal, 'stepTotal')
  if (stepTotal < stepIndex) {
    throw new Error('stepTotal must be greater than or equal to stepIndex')
  }
  return {
    stepKey: requireTrimmed(source.stepKey, 'stepKey'),
    stepTitle: requireTrimmed(source.stepTitle, 'stepTitle'),
    stepIndex,
    stepTotal,
    attempt: requirePositiveInt(source.attempt, 'attempt'),
  }
}

function buildStepPayloadBase<TActivityType extends TemporalWorkflowStepActivityType>(input: {
  activityId: string
  temporalActivityType: TActivityType
  step?: TemporalWorkflowStepDescriptor | null
}) {
  if (!input.activityId.trim()) {
    throw new Error('activityId is required')
  }
  const step = normalizeTemporalWorkflowStepDescriptor(input.step)
  return {
    temporalActivityType: input.temporalActivityType,
    activityId: input.activityId,
    stepKey: step.stepKey,
    stepTitle: step.stepTitle,
    stepIndex: step.stepIndex,
    stepTotal: step.stepTotal,
    stepAttempt: step.attempt,
  }
}

export function buildTemporalWorkflowStepStartedPayload(input: {
  activityId: string
  step?: TemporalWorkflowStepDescriptor | null
}): TemporalWorkflowStepPayload {
  return buildStepPayloadBase({
    activityId: input.activityId,
    temporalActivityType: 'recordWorkflowStepStarted',
    step: input.step,
  })
}

export function buildTemporalWorkflowStepCompletedPayload(input: {
  activityId: string
  result: TemporalWorkflowRunResult
  step?: TemporalWorkflowStepDescriptor | null
  text?: string
}): TemporalWorkflowStepPayload {
  return {
    ...buildStepPayloadBase({
      activityId: input.activityId,
      temporalActivityType: 'recordWorkflowStepCompleted',
      step: input.step,
    }),
    text: input.text || 'Temporal smoke workflow completed',
    artifactPayload: input.result,
  }
}

export function buildTemporalWorkflowFailurePayload(input: {
  activityId: string
  failure: TemporalWorkflowFailureInput
}): TemporalWorkflowFailurePayload {
  return {
    temporalActivityType: 'recordWorkflowFailed',
    activityId: requireTrimmed(input.activityId, 'activityId'),
    ...normalizeFailureDetails(input.failure),
  }
}

export function buildTemporalWorkflowStepFailurePayload(input: {
  activityId: string
  failure: TemporalWorkflowFailureInput
  step?: TemporalWorkflowStepDescriptor | null
}): TemporalWorkflowStepFailurePayload {
  const failureDetails = normalizeFailureDetails(input.failure)
  return {
    ...buildStepPayloadBase({
      activityId: input.activityId,
      temporalActivityType: 'recordWorkflowStepFailed',
      step: input.step,
    }),
    ...failureDetails,
    artifactPayload: failureDetails,
  }
}
