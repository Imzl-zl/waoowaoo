import { createHash } from 'crypto'
import { appendRunEventWithSeq } from '@/lib/run-runtime/service'
import { RUN_EVENT_TYPE, type RunEvent, type RunEventInput, type RunEventType } from '@/lib/run-runtime/types'
import { normalizeTemporalWorkflowRunInput } from './contract'
import type { TemporalWorkflowRunInput } from './types'

const TEMPORAL_RUN_EVENT_KEY_PREFIX = 'temporal-run-event'

export type TemporalRunEventWriter = (input: RunEventInput) => Promise<RunEvent>

export type TemporalRunLifecycleEventInput = Readonly<{
  workflow: TemporalWorkflowRunInput
  eventType: RunEventType
  stepKey?: string | null
  attempt?: number | null
  lane?: 'text' | 'reasoning' | null
  payload?: Record<string, unknown> | null
}>

function assertLifecycleEventType(eventType: RunEventType) {
  if (eventType === RUN_EVENT_TYPE.STEP_CHUNK) {
    throw new Error('step.chunk is a high-frequency stream event and is not a Temporal lifecycle event')
  }
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeAttempt(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('attempt must be a positive number when provided')
  }
  return Math.floor(value)
}

function normalizePayload(value: TemporalRunLifecycleEventInput['payload']) {
  if (value === undefined || value === null) return null
  if (Array.isArray(value) || typeof value !== 'object') {
    throw new Error('payload must be an object when provided')
  }
  return value
}

function hashIdempotencyParts(parts: readonly unknown[]): string {
  const digest = createHash('sha256')
    .update(JSON.stringify(parts))
    .digest('hex')
  return `${TEMPORAL_RUN_EVENT_KEY_PREFIX}:${digest}`
}

export function buildTemporalRunEventIdempotencyKey(
  input: TemporalRunLifecycleEventInput,
): string {
  const workflow = normalizeTemporalWorkflowRunInput(input.workflow)
  assertLifecycleEventType(input.eventType)
  return hashIdempotencyParts([
    workflow.runId,
    workflow.workflowType,
    input.eventType,
    normalizeOptionalString(input.stepKey),
    normalizeAttempt(input.attempt),
    input.lane || null,
  ])
}

export function buildTemporalRunLifecycleEventInput(
  input: TemporalRunLifecycleEventInput,
): RunEventInput {
  const workflow = normalizeTemporalWorkflowRunInput(input.workflow)
  assertLifecycleEventType(input.eventType)
  return {
    runId: workflow.runId,
    projectId: workflow.projectId,
    userId: workflow.userId,
    eventType: input.eventType,
    stepKey: normalizeOptionalString(input.stepKey),
    attempt: normalizeAttempt(input.attempt),
    lane: input.lane || null,
    idempotencyKey: buildTemporalRunEventIdempotencyKey(input),
    payload: normalizePayload(input.payload),
  }
}

export async function recordTemporalRunLifecycleEvent(
  input: TemporalRunLifecycleEventInput,
  writeRunEvent: TemporalRunEventWriter = appendRunEventWithSeq,
): Promise<RunEvent> {
  return await writeRunEvent(buildTemporalRunLifecycleEventInput(input))
}
