import type {
  RunStepStatus,
  RunStreamEvent,
  RunStreamLane,
  RunStreamStatus,
} from '@/lib/novel-promotion/run-stream/types'
import type {
  RunState,
  RunStepState,
  StageViewStatus,
} from './types'

export function toTimestamp(ts: string | undefined, fallback: number): number {
  if (!ts) return fallback
  const parsed = Date.parse(ts)
  return Number.isFinite(parsed) ? parsed : fallback
}

function rankStepStatus(status: RunStepStatus): number {
  if (status === 'pending' || status === 'blocked') return 0
  if (status === 'running') return 1
  if (status === 'completed' || status === 'stale') return 2
  return 3
}

function rankRunStatus(status: RunStreamStatus): number {
  if (status === 'idle') return 0
  if (status === 'running') return 1
  if (status === 'completed') return 2
  return 3
}

export function lockForwardStepStatus(prev: RunStepStatus, next: RunStepStatus): RunStepStatus {
  if (prev === 'failed') return prev
  if (prev === 'completed' && next !== 'stale') return prev
  if (prev === 'stale' && next !== 'failed') return prev
  return rankStepStatus(next) >= rankStepStatus(prev) ? next : prev
}

export function lockForwardRunStatus(prev: RunStreamStatus, next: RunStreamStatus): RunStreamStatus {
  if (prev === 'completed' || prev === 'failed') return prev
  return rankRunStatus(next) >= rankRunStatus(prev) ? next : prev
}

export function normalizeLane(value: unknown): RunStreamLane {
  return value === 'reasoning' ? 'reasoning' : 'text'
}

function splitThinkTaggedContent(input: string): { text: string; reasoning: string } {
  const thinkTagPattern = /<(think|thinking)\b[^>]*>([\s\S]*?)<\/\1>/gi
  const reasoningParts: string[] = []
  let matched = false

  const stripped = input.replace(thinkTagPattern, (_fullMatch, _tagName: string, inner: string) => {
    matched = true
    const trimmed = inner.trim()
    if (trimmed) reasoningParts.push(trimmed)
    return ''
  })

  if (!matched) {
    return {
      text: input,
      reasoning: '',
    }
  }

  return {
    text: stripped.trim(),
    reasoning: reasoningParts.join('\n\n').trim(),
  }
}

function mergeReasoningText(current: string, incoming: string): string {
  const next = incoming.trim()
  if (!next) return current
  const prev = current.trim()
  if (!prev) return next
  if (prev.includes(next)) return current
  return `${prev}\n\n${next}`
}

export function normalizeThinkTaggedStepOutput(step: RunStepState) {
  if (!step.textOutput) return
  const parsed = splitThinkTaggedContent(step.textOutput)
  if (!parsed.reasoning) return
  step.textOutput = parsed.text
  step.reasoningOutput = mergeReasoningText(step.reasoningOutput, parsed.reasoning)
}

export function parseStepIdentity(rawStepId: string): {
  canonicalStepId: string
  attempt: number
} {
  const matched = rawStepId.match(/^(.*)_r([0-9]+)$/)
  if (!matched) {
    return {
      canonicalStepId: rawStepId,
      attempt: 1,
    }
  }
  const baseStepId = matched[1]?.trim()
  const attempt = Number.parseInt(matched[2] || '1', 10)
  if (!baseStepId || !Number.isFinite(attempt) || attempt < 2) {
    return {
      canonicalStepId: rawStepId,
      attempt: 1,
    }
  }
  return {
    canonicalStepId: baseStepId,
    attempt,
  }
}

export function normalizeStepStatus(value: unknown): RunStepStatus {
  if (
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'blocked' ||
    value === 'stale'
  ) {
    return value
  }
  return 'pending'
}

export function normalizeRunStatus(value: unknown): RunStreamStatus {
  if (value === 'running' || value === 'completed' || value === 'failed') return value
  return 'idle'
}

export function toStageViewStatus(status: RunStepStatus): StageViewStatus {
  if (status === 'running') return 'processing'
  if (status === 'pending') return 'pending'
  if (status === 'blocked') return 'blocked'
  if (status === 'stale') return 'stale'
  if (status === 'completed') return 'completed'
  return 'failed'
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const rows: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed) continue
    rows.push(trimmed)
  }
  return rows
}

export function mergeStringArray(base: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return base
  const seen = new Set<string>()
  const next: string[] = []
  for (const item of incoming) {
    if (seen.has(item)) continue
    seen.add(item)
    next.push(item)
  }
  return next
}

export function readBool(value: unknown): boolean | null {
  if (value === true) return true
  if (value === false) return false
  return null
}

export function buildDefaultStep(event: RunStreamEvent, now: number): RunStepState {
  const stepId = event.stepId || 'unknown_step'
  const stepAttempt =
    typeof event.stepAttempt === 'number' && Number.isFinite(event.stepAttempt)
      ? Math.max(1, Math.floor(event.stepAttempt))
      : 1
  const stepTitle = typeof event.stepTitle === 'string' && event.stepTitle.trim() ? event.stepTitle : stepId
  const stepIndex =
    typeof event.stepIndex === 'number' && Number.isFinite(event.stepIndex)
      ? Math.max(1, Math.floor(event.stepIndex))
      : 1
  const stepTotal =
    typeof event.stepTotal === 'number' && Number.isFinite(event.stepTotal)
      ? Math.max(stepIndex, Math.floor(event.stepTotal))
      : stepIndex

  return {
    id: stepId,
    attempt: stepAttempt,
    title: stepTitle,
    stepIndex,
    stepTotal,
    status: 'pending',
    dependsOn: [],
    blockedBy: [],
    groupId: null,
    parallelKey: null,
    retryable: true,
    textOutput: '',
    reasoningOutput: '',
    textLength: 0,
    reasoningLength: 0,
    message: '',
    errorMessage: '',
    updatedAt: now,
    seqByLane: {
      text: 0,
      reasoning: 0,
    },
  }
}

export function resetStepForRetry(step: RunStepState, attempt: number) {
  step.attempt = attempt
  step.status = 'pending'
  step.textOutput = ''
  step.reasoningOutput = ''
  step.textLength = 0
  step.reasoningLength = 0
  step.message = ''
  step.errorMessage = ''
  step.blockedBy = []
  step.seqByLane = {
    text: 0,
    reasoning: 0,
  }
}

export function createInitialRunState(runId: string, now: number): RunState {
  return {
    runId,
    status: 'running',
    startedAt: now,
    updatedAt: now,
    terminalAt: null,
    errorMessage: '',
    summary: null,
    payload: null,
    stepsById: {},
    stepOrder: [],
    activeStepId: null,
    selectedStepId: null,
  }
}

function computeStepDependencyLevel(params: {
  stepId: string
  stepsById: Record<string, RunStepState>
  memo: Map<string, number>
  visiting: Set<string>
}): number {
  const { stepId, stepsById, memo, visiting } = params
  const cached = memo.get(stepId)
  if (typeof cached === 'number') return cached
  const step = stepsById[stepId]
  if (!step) return 0
  if (visiting.has(stepId)) {
    return Math.max(0, step.stepIndex - 1)
  }
  visiting.add(stepId)
  let level = 0
  for (const dep of step.dependsOn) {
    const depLevel = computeStepDependencyLevel({
      stepId: dep,
      stepsById,
      memo,
      visiting,
    })
    level = Math.max(level, depLevel + 1)
  }
  visiting.delete(stepId)
  memo.set(stepId, level)
  return level
}

export function finalizeRunState(base: RunState, prevActiveStepId: string | null) {
  const levelMemo = new Map<string, number>()
  base.stepOrder = [...base.stepOrder].sort((left, right) => {
    const leftStep = base.stepsById[left]
    const rightStep = base.stepsById[right]
    if (!leftStep || !rightStep) return 0
    const levelLeft = computeStepDependencyLevel({
      stepId: left,
      stepsById: base.stepsById,
      memo: levelMemo,
      visiting: new Set<string>(),
    })
    const levelRight = computeStepDependencyLevel({
      stepId: right,
      stepsById: base.stepsById,
      memo: levelMemo,
      visiting: new Set<string>(),
    })
    if (levelLeft !== levelRight) return levelLeft - levelRight
    if (leftStep.stepIndex !== rightStep.stepIndex) return leftStep.stepIndex - rightStep.stepIndex
    return leftStep.id.localeCompare(rightStep.id)
  })

  const runningSteps = Object.values(base.stepsById).filter((item) => item.status === 'running')
  if (runningSteps.length > 0) {
    const maxRunningStepIndex = Math.max(...runningSteps.map((item) => item.stepIndex))
    const topCandidates = runningSteps
      .filter((item) => item.stepIndex === maxRunningStepIndex)
      .sort((left, right) => {
        if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt
        return left.id.localeCompare(right.id)
      })
    const keepCurrentActive =
      base.activeStepId && topCandidates.some((item) => item.id === base.activeStepId)
        ? base.activeStepId
        : null
    base.activeStepId = keepCurrentActive || topCandidates[0]?.id || null
  } else {
    const allSteps = Object.values(base.stepsById)
    if (allSteps.length === 0) {
      base.activeStepId = null
    } else {
      const maxStepIndex = Math.max(...allSteps.map((item) => item.stepIndex))
      const topCandidates = allSteps
        .filter((item) => item.stepIndex === maxStepIndex)
        .sort((left, right) => {
          if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt
          return left.id.localeCompare(right.id)
        })
      base.activeStepId = topCandidates[0]?.id || null
    }
  }

  if (
    !base.selectedStepId ||
    !base.stepsById[base.selectedStepId] ||
    base.selectedStepId === prevActiveStepId
  ) {
    base.selectedStepId = base.activeStepId
  }

  return base
}

export function getStageOutput(step: RunStepState | null) {
  if (!step) return ''
  if (step.reasoningOutput && step.textOutput) {
    return `【思考过程】\n${step.reasoningOutput}\n\n【最终结果】\n${step.textOutput}`
  }
  if (step.reasoningOutput) return `【思考过程】\n${step.reasoningOutput}`
  if (step.textOutput) return `【最终结果】\n${step.textOutput}`
  if (step.status === 'failed' && step.errorMessage) return `【错误】\n${step.errorMessage}`
  return ''
}
