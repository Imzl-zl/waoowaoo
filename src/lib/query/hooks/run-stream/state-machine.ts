import type {
  RunStreamEvent,
} from '@/lib/novel-promotion/run-stream/types'
import type {
  RunState,
} from './types'
import {
  buildDefaultStep,
  createInitialRunState,
  finalizeRunState,
  getStageOutput,
  lockForwardRunStatus,
  lockForwardStepStatus,
  mergeStringArray,
  normalizeLane,
  normalizeRunStatus,
  normalizeStepStatus,
  normalizeThinkTaggedStepOutput,
  parseStepIdentity,
  readBool,
  readStringArray,
  resetStepForRetry,
  toStageViewStatus,
  toTimestamp,
} from './state-machine.shared'

export { getStageOutput, toStageViewStatus, toTimestamp } from './state-machine.shared'

export function applyRunStreamEvent(prev: RunState | null, event: RunStreamEvent): RunState | null {
  const now = toTimestamp(event.ts, Date.now())
  const runId = event.runId || prev?.runId || ''
  if (!runId) return prev

  const base: RunState =
    prev && prev.runId === runId
      ? { ...prev }
      : createInitialRunState(runId, now)
  const prevActiveStepId = base.activeStepId

  base.updatedAt = now

  if (event.event === 'run.start') {
    const nextStatus = normalizeRunStatus(event.status)
    base.status = lockForwardRunStatus(base.status, nextStatus === 'idle' ? 'running' : nextStatus)
    if (event.payload && typeof event.payload === 'object') {
      base.payload = event.payload
    }
    return base
  }

  if (event.event === 'run.complete') {
    base.status = lockForwardRunStatus(base.status, 'completed')
    base.summary =
      event.payload?.summary && typeof event.payload.summary === 'object'
        ? (event.payload.summary as Record<string, unknown>)
        : event.payload || base.summary
    base.payload = event.payload || base.payload
    const finalizedSteps = { ...base.stepsById }
    for (const stepId of base.stepOrder) {
      const currentStep = finalizedSteps[stepId]
      if (!currentStep) continue
      if (currentStep.status === 'completed' || currentStep.status === 'failed' || currentStep.status === 'stale') continue
      finalizedSteps[stepId] = {
        ...currentStep,
        status: 'completed',
        updatedAt: now,
      }
    }
    base.stepsById = finalizedSteps
    base.terminalAt = now
    return base
  }

  if (event.event === 'run.error') {
    base.status = lockForwardRunStatus(base.status, 'failed')
    const runErrorMessage = typeof event.message === 'string' ? event.message : base.errorMessage
    base.errorMessage = runErrorMessage
    const nextStepsById = { ...base.stepsById }
    for (const stepId of base.stepOrder) {
      const currentStep = nextStepsById[stepId]
      if (!currentStep) continue
      if (currentStep.status === 'completed' || currentStep.status === 'failed') continue
      nextStepsById[stepId] = {
        ...currentStep,
        status: 'failed',
        errorMessage: currentStep.errorMessage || runErrorMessage,
        updatedAt: now,
      }
    }
    base.stepsById = nextStepsById
    base.terminalAt = now
    return base
  }

  const rawStepId = event.stepId
  if (!rawStepId) return base

  const stepIdentity = parseStepIdentity(rawStepId)
  const stepId = stepIdentity.canonicalStepId
  const incomingAttempt =
    typeof event.stepAttempt === 'number' && Number.isFinite(event.stepAttempt)
      ? Math.max(1, Math.floor(event.stepAttempt))
      : stepIdentity.attempt
  const existingStep = base.stepsById[stepId]
  const step = existingStep
    ? { ...existingStep }
    : buildDefaultStep({ ...event, stepId, stepAttempt: incomingAttempt }, now)
  if (!Number.isFinite(step.attempt) || step.attempt < 1) {
    step.attempt = 1
  }

  if (incomingAttempt < step.attempt) {
    return base
  }

  if (incomingAttempt > step.attempt) {
    resetStepForRetry(step, incomingAttempt)
    base.errorMessage = ''
  }

  step.updatedAt = now
  if (typeof event.stepTitle === 'string' && event.stepTitle.trim()) {
    step.title = event.stepTitle.trim()
  }
  if (typeof event.stepIndex === 'number' && Number.isFinite(event.stepIndex)) {
    step.stepIndex = Math.max(1, Math.floor(event.stepIndex))
  }
  if (typeof event.stepTotal === 'number' && Number.isFinite(event.stepTotal)) {
    step.stepTotal = Math.max(step.stepIndex, Math.floor(event.stepTotal))
  }
  if (Array.isArray(event.dependsOn)) {
    step.dependsOn = mergeStringArray(step.dependsOn, readStringArray(event.dependsOn))
  }
  if (Array.isArray(event.blockedBy)) {
    step.blockedBy = mergeStringArray(step.blockedBy, readStringArray(event.blockedBy))
  }
  if (typeof event.groupId === 'string' && event.groupId.trim()) {
    step.groupId = event.groupId.trim()
  }
  if (typeof event.parallelKey === 'string' && event.parallelKey.trim()) {
    step.parallelKey = event.parallelKey.trim()
  }
  if (typeof event.retryable === 'boolean') {
    step.retryable = event.retryable
  }

  if (event.event === 'step.start') {
    if (event.blockedBy && event.blockedBy.length > 0) {
      step.status = lockForwardStepStatus(step.status, 'blocked')
    } else {
      step.blockedBy = []
      step.status = lockForwardStepStatus(step.status, 'running')
      base.status = lockForwardRunStatus(base.status, 'running')
    }
  }

  if (event.event === 'step.chunk') {
    const lane = normalizeLane(event.lane)
    const seq =
      typeof event.seq === 'number' && Number.isFinite(event.seq)
        ? Math.max(1, Math.floor(event.seq))
        : null
    const lastSeq = step.seqByLane[lane]
    if (seq === null || seq > lastSeq) {
      if (step.status === 'completed') {
        step.status = 'running'
      }
      if (seq !== null) {
        step.seqByLane = {
          ...step.seqByLane,
          [lane]: seq,
        }
      }

      if (lane === 'reasoning') {
        const delta =
          typeof event.reasoningDelta === 'string'
            ? event.reasoningDelta
            : typeof event.textDelta === 'string'
              ? event.textDelta
              : ''
        if (delta) step.reasoningOutput += delta
      } else {
        const delta =
          typeof event.textDelta === 'string'
            ? event.textDelta
            : typeof event.reasoningDelta === 'string'
              ? event.reasoningDelta
              : ''
        if (delta) {
          step.textOutput += delta
          normalizeThinkTaggedStepOutput(step)
        }
      }
    }

    if (event.blockedBy && event.blockedBy.length > 0) {
      step.status = lockForwardStepStatus(step.status, 'blocked')
    } else {
      step.blockedBy = []
      step.status = lockForwardStepStatus(step.status, 'running')
      base.status = lockForwardRunStatus(base.status, 'running')
    }
    step.textLength = step.textOutput.length
    step.reasoningLength = step.reasoningOutput.length
  }

  if (event.event === 'step.complete') {
    if (typeof event.text === 'string' && event.text.length >= step.textOutput.length) {
      step.textOutput = event.text
      normalizeThinkTaggedStepOutput(step)
    }
    if (typeof event.reasoning === 'string' && event.reasoning.length >= step.reasoningOutput.length) {
      step.reasoningOutput = event.reasoning
    }
    step.textLength = step.textOutput.length
    step.reasoningLength = step.reasoningOutput.length
    const normalizedStatus = normalizeStepStatus(event.status)
    if (normalizedStatus === 'stale') {
      step.status = lockForwardStepStatus(step.status, 'stale')
    } else {
      step.status = lockForwardStepStatus(
        step.status,
        normalizedStatus === 'failed' ? 'failed' : 'completed',
      )
    }
  }

  if (event.event === 'step.error') {
    step.status = lockForwardStepStatus(step.status, 'failed')
    step.errorMessage = typeof event.message === 'string' ? event.message : step.errorMessage
    base.errorMessage = step.errorMessage || base.errorMessage
  }

  if (typeof event.message === 'string' && event.message) {
    step.message = event.message
  }
  const staleByPayload = readBool(event.payload?.stale)
  if (staleByPayload === true) {
    step.status = 'stale'
  }
  const blockedByFromEvent = Array.isArray(event.blockedBy) ? readStringArray(event.blockedBy) : []
  const blockedByPayload = readStringArray(event.payload?.blockedBy)
  const blockedBy = blockedByPayload.length > 0 ? blockedByPayload : blockedByFromEvent
  if (blockedBy.length > 0) {
    step.blockedBy = blockedBy
    if (step.status !== 'failed' && step.status !== 'completed') {
      step.status = 'blocked'
    }
  } else if (event.event === 'step.start' || event.event === 'step.chunk') {
    step.blockedBy = []
  }

  base.stepsById = {
    ...base.stepsById,
    [stepId]: step,
  }
  if (!base.stepOrder.includes(stepId)) {
    base.stepOrder = [...base.stepOrder, stepId]
  }

  return finalizeRunState(base, prevActiveStepId)
}
