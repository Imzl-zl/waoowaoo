'use client'

import type { TaskIntent } from '@/lib/task/intent'
import type { TaskTargetOverlayMap } from '../task-target-overlay'
import { createScopedLogger } from '@/lib/logging/core'
import { apiFetch } from '@/lib/api-fetch'

export type TaskTargetStateQuery = {
  targetType: string
  targetId: string
  types?: string[]
}

export type TaskTargetState = {
  targetType: string
  targetId: string
  phase: 'idle' | 'queued' | 'processing' | 'completed' | 'failed'
  runningTaskId: string | null
  runningTaskType: string | null
  intent: TaskIntent
  hasOutputAtStart: boolean | null
  progress: number | null
  stage: string | null
  stageLabel: string | null
  lastError: {
    code: string
    message: string
  } | null
  updatedAt: string | null
}

type TaskTargetStateBatchSubscriber = {
  targets: TaskTargetStateQuery[]
  resolve: (states: TaskTargetState[]) => void
  reject: (error: unknown) => void
}

type TaskTargetStateBatch = {
  targetsByKey: Map<string, TaskTargetStateQuery>
  subscribers: TaskTargetStateBatchSubscriber[]
  timer: ReturnType<typeof setTimeout> | null
}

const TARGET_STATE_BATCH_WINDOW_MS = 120
const TARGET_STATE_CHUNK_SIZE = 500
const pendingTaskTargetStateBatches = new Map<string, TaskTargetStateBatch>()
const mergeTraceSignatureByKey = new Map<string, string>()
const taskTargetStateLogger = createScopedLogger({
  module: 'query.use-task-target-state-map',
})

function traceFrontend(event: string, details: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  console.info(`[FE_TASK_TRACE] ${event}`, details)
}

export function taskTargetStateKey(targetType: string, targetId: string) {
  return `${targetType}:${targetId}`
}

function targetQueryKey(target: TaskTargetStateQuery) {
  const types = (target.types || []).filter(Boolean).sort()
  return `${target.targetType}:${target.targetId}:${types.join(',')}`
}

export function normalizeTargets(targets: TaskTargetStateQuery[]) {
  const deduped = new Map<string, TaskTargetStateQuery>()
  for (const target of targets) {
    if (!target.targetType || !target.targetId) continue
    const types = (target.types || []).filter(Boolean).sort()
    const key = `${target.targetType}:${target.targetId}:${types.join(',')}`
    deduped.set(key, {
      targetType: target.targetType,
      targetId: target.targetId,
      ...(types.length ? { types } : {}),
    })
  }
  return Array.from(deduped.values()).sort((left, right) => {
    const leftTypes = (left.types || []).join(',')
    const rightTypes = (right.types || []).join(',')
    if (left.targetType !== right.targetType) return left.targetType.localeCompare(right.targetType)
    if (left.targetId !== right.targetId) return left.targetId.localeCompare(right.targetId)
    return leftTypes.localeCompare(rightTypes)
  })
}

export function buildIdleState(target: TaskTargetStateQuery): TaskTargetState {
  return {
    targetType: target.targetType,
    targetId: target.targetId,
    phase: 'idle',
    runningTaskId: null,
    runningTaskType: null,
    intent: 'process',
    hasOutputAtStart: null,
    progress: null,
    stage: null,
    stageLabel: null,
    lastError: null,
    updatedAt: null,
  }
}

function matchesTaskTypeWhitelist(
  whitelist: string[] | undefined,
  runningTaskType: string | null,
): boolean {
  if (!whitelist || whitelist.length === 0) return true
  if (!runningTaskType) return true
  const normalized = runningTaskType.toLowerCase()
  return whitelist.some((type) => type.toLowerCase() === normalized)
}

function shouldTraceMergeTarget(targetType: string) {
  return targetType === 'NovelPromotionPanel'
}

function logMergeDecision(params: {
  projectId: string | null | undefined
  key: string
  decision:
    | 'overlay_applied'
    | 'overlay_expired'
    | 'overlay_phase_ignored'
    | 'overlay_task_type_mismatch'
    | 'server_processing_authoritative'
  runtimePhase: string | null
  runtimeTaskId: string | null
  runtimeTaskType: string | null
  currentPhase: string | null
  whitelist: string[]
}) {
  const signature = [
    params.decision,
    params.runtimePhase || '',
    params.runtimeTaskId || '',
    params.runtimeTaskType || '',
    params.currentPhase || '',
    params.whitelist.join(','),
  ].join('|')
  const last = mergeTraceSignatureByKey.get(params.key)
  if (last === signature) return
  mergeTraceSignatureByKey.set(params.key, signature)
  taskTargetStateLogger.info({
    action: 'task-state.merge.decision',
    message: 'task state merge decision',
    details: {
      projectId: params.projectId || null,
      key: params.key,
      decision: params.decision,
      runtimePhase: params.runtimePhase,
      runtimeTaskId: params.runtimeTaskId,
      runtimeTaskType: params.runtimeTaskType,
      currentPhase: params.currentPhase,
      whitelist: params.whitelist,
    },
  })
  traceFrontend('task-state.merge.decision', {
    projectId: params.projectId || null,
    key: params.key,
    decision: params.decision,
    runtimePhase: params.runtimePhase,
    runtimeTaskId: params.runtimeTaskId,
    runtimeTaskType: params.runtimeTaskType,
    currentPhase: params.currentPhase,
    whitelist: params.whitelist,
  })
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function fetchTargetStatesChunk(
  projectId: string,
  targets: TaskTargetStateQuery[],
): Promise<TaskTargetState[]> {
  const response = await apiFetch('/api/task-target-states', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, targets }),
  })
  if (!response.ok) {
    throw new Error('Failed to fetch task target states')
  }
  const payload = await response.json()
  return (payload?.states || []) as TaskTargetState[]
}

async function flushTaskTargetStateBatch(projectId: string) {
  const batch = pendingTaskTargetStateBatches.get(projectId)
  if (!batch) return

  pendingTaskTargetStateBatches.delete(projectId)
  const mergedTargets = Array.from(batch.targetsByKey.values())
  const subscribers = batch.subscribers.slice()

  try {
    const chunks = chunkArray(mergedTargets, TARGET_STATE_CHUNK_SIZE)
    const chunkResults = await Promise.all(
      chunks.map((chunk) => fetchTargetStatesChunk(projectId, chunk)),
    )

    const byTargetQueryKey = new Map<string, TaskTargetState>()
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunkTargets = chunks[chunkIndex]
      const chunkStates = chunkResults[chunkIndex]
      for (let index = 0; index < chunkTargets.length && index < chunkStates.length; index++) {
        byTargetQueryKey.set(targetQueryKey(chunkTargets[index]), chunkStates[index])
      }
    }

    for (const subscriber of subscribers) {
      const subset: TaskTargetState[] = []
      for (const target of subscriber.targets) {
        const state = byTargetQueryKey.get(targetQueryKey(target))
        if (state) subset.push(state)
      }
      subscriber.resolve(subset)
    }
  } catch (error) {
    for (const subscriber of subscribers) {
      subscriber.reject(error)
    }
  }
}

export function fetchTaskTargetStatesBatched(
  projectId: string,
  targets: TaskTargetStateQuery[],
) {
  return new Promise<TaskTargetState[]>((resolve, reject) => {
    const batchKey = projectId
    let batch = pendingTaskTargetStateBatches.get(batchKey)
    if (!batch) {
      batch = {
        targetsByKey: new Map<string, TaskTargetStateQuery>(),
        subscribers: [],
        timer: null,
      }
      pendingTaskTargetStateBatches.set(batchKey, batch)
    }

    for (const target of targets) {
      batch.targetsByKey.set(targetQueryKey(target), target)
    }
    batch.subscribers.push({
      targets,
      resolve,
      reject,
    })

    if (!batch.timer) {
      batch.timer = setTimeout(() => {
        void flushTaskTargetStateBatch(batchKey)
      }, TARGET_STATE_BATCH_WINDOW_MS)
    }
  })
}

export function mergeTaskTargetStates(params: {
  projectId: string | null | undefined
  targets: TaskTargetStateQuery[]
  serverStates: TaskTargetState[] | undefined
  overlay: TaskTargetOverlayMap | undefined
}) {
  const map = new Map<string, TaskTargetState>()
  for (const state of params.serverStates || []) {
    map.set(taskTargetStateKey(state.targetType, state.targetId), state)
  }

  const overlay = params.overlay || {}
  const now = Date.now()
  for (const target of params.targets) {
    const key = taskTargetStateKey(target.targetType, target.targetId)
    const runtime = overlay[key]
    if (!runtime) continue

    if (runtime.expiresAt && runtime.expiresAt <= now) {
      if (shouldTraceMergeTarget(target.targetType)) {
        logMergeDecision({
          projectId: params.projectId,
          key,
          decision: 'overlay_expired',
          runtimePhase: runtime.phase,
          runtimeTaskId: runtime.runningTaskId,
          runtimeTaskType: runtime.runningTaskType,
          currentPhase: map.get(key)?.phase || null,
          whitelist: target.types || [],
        })
      }
      continue
    }

    if (runtime.phase !== 'queued' && runtime.phase !== 'processing') {
      if (shouldTraceMergeTarget(target.targetType)) {
        logMergeDecision({
          projectId: params.projectId,
          key,
          decision: 'overlay_phase_ignored',
          runtimePhase: runtime.phase,
          runtimeTaskId: runtime.runningTaskId,
          runtimeTaskType: runtime.runningTaskType,
          currentPhase: map.get(key)?.phase || null,
          whitelist: target.types || [],
        })
      }
      continue
    }

    if (!matchesTaskTypeWhitelist(target.types, runtime.runningTaskType)) {
      if (shouldTraceMergeTarget(target.targetType)) {
        logMergeDecision({
          projectId: params.projectId,
          key,
          decision: 'overlay_task_type_mismatch',
          runtimePhase: runtime.phase,
          runtimeTaskId: runtime.runningTaskId,
          runtimeTaskType: runtime.runningTaskType,
          currentPhase: map.get(key)?.phase || null,
          whitelist: target.types || [],
        })
      }
      continue
    }

    const current = map.get(key)
    if (current?.phase === 'processing') {
      if (shouldTraceMergeTarget(target.targetType)) {
        logMergeDecision({
          projectId: params.projectId,
          key,
          decision: 'server_processing_authoritative',
          runtimePhase: runtime.phase,
          runtimeTaskId: runtime.runningTaskId,
          runtimeTaskType: runtime.runningTaskType,
          currentPhase: current.phase,
          whitelist: target.types || [],
        })
      }
      continue
    }

    map.set(key, {
      ...(current || buildIdleState(target)),
      ...runtime,
      phase: runtime.phase,
      targetType: target.targetType,
      targetId: target.targetId,
      lastError: null,
    })

    if (shouldTraceMergeTarget(target.targetType)) {
      logMergeDecision({
        projectId: params.projectId,
        key,
        decision: 'overlay_applied',
        runtimePhase: runtime.phase,
        runtimeTaskId: runtime.runningTaskId,
        runtimeTaskType: runtime.runningTaskType,
        currentPhase: current?.phase || null,
        whitelist: target.types || [],
      })
    }
  }

  return map
}

export function materializeTaskTargetStates(
  targets: TaskTargetStateQuery[],
  mergedByKey: Map<string, TaskTargetState>,
) {
  return targets.map((target) =>
    mergedByKey.get(taskTargetStateKey(target.targetType, target.targetId)) || buildIdleState(target),
  )
}

export function buildTaskTargetStateMap(states: TaskTargetState[]) {
  const map = new Map<string, TaskTargetState>()
  for (const state of states) {
    map.set(taskTargetStateKey(state.targetType, state.targetId), state)
  }
  return map
}

export function getTaskTargetStateRefetchInterval(
  data: TaskTargetState[] | undefined,
) {
  if (!data) return false
  return data.some((item) => item.phase === 'queued' || item.phase === 'processing')
    ? 2000
    : false
}
