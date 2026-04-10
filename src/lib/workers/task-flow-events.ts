import { publishTaskEvent, publishTaskStreamEvent } from '@/lib/task/publisher'
import {
  TASK_EVENT_TYPE,
  TASK_SSE_EVENT_TYPE,
  TASK_TYPE,
  type SSEEvent,
  type TaskJobData,
} from '@/lib/task/types'
import { mapTaskSSEEventToRunEvents } from '@/lib/run-runtime/task-bridge'
import { publishRunEvent } from '@/lib/run-runtime/publisher'
import { RUN_EVENT_TYPE } from '@/lib/run-runtime/types'

const RUN_STREAM_REPLAY_PERSIST_TYPES = new Set<string>([
  TASK_TYPE.STORY_TO_SCRIPT_RUN,
  TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
])

const DIRECT_RUN_EVENT_TASK_TYPES = new Set<string>([
  TASK_TYPE.STORY_TO_SCRIPT_RUN,
  TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
])

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readStringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function readPositiveIntField(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key]
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return null
}

function extractFlowFields(jobData: TaskJobData): Record<string, unknown> {
  const payload = toObject(jobData.payload)
  const flowId = readStringField(payload, 'flowId')
  const flowStageTitle = readStringField(payload, 'flowStageTitle')
  const flowStageIndex = readPositiveIntField(payload, 'flowStageIndex')
  const flowStageTotal = readPositiveIntField(payload, 'flowStageTotal')
  const payloadMeta = toObject(payload.meta)
  const runId = readStringField(payload, 'runId') || readStringField(payloadMeta, 'runId')

  return {
    ...(flowId ? { flowId } : {}),
    ...(flowStageTitle ? { flowStageTitle } : {}),
    ...(flowStageIndex ? { flowStageIndex } : {}),
    ...(flowStageTotal ? { flowStageTotal } : {}),
    ...(runId ? { runId } : {}),
  }
}

function shouldDirectPublishRunEvents(taskType: string): boolean {
  return DIRECT_RUN_EVENT_TASK_TYPES.has(taskType)
}

async function publishMirroredRunEvents(params: {
  taskId: string
  projectId: string
  userId: string
  taskType: string
  targetType: string
  targetId: string
  episodeId?: string | null
  eventType: typeof TASK_SSE_EVENT_TYPE[keyof typeof TASK_SSE_EVENT_TYPE]
  payload?: Record<string, unknown> | null
}) {
  if (!shouldDirectPublishRunEvents(params.taskType)) return

  const message: SSEEvent = {
    id: `direct:${params.taskId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    type: params.eventType,
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    ts: new Date().toISOString(),
    taskType: params.taskType,
    targetType: params.targetType,
    targetId: params.targetId,
    episodeId: params.episodeId || null,
    payload: (params.payload || null) as SSEEvent['payload'],
  }
  const runEvents = mapTaskSSEEventToRunEvents(message)
  for (const event of runEvents) {
    await publishRunEvent(event)
  }
}

export function withFlowFields(jobData: TaskJobData, payload?: Record<string, unknown> | null): Record<string, unknown> {
  const base = { ...(payload || {}) }
  const flowFields = extractFlowFields(jobData)
  for (const [key, value] of Object.entries(flowFields)) {
    if (base[key] === undefined || base[key] === null || base[key] === '') {
      base[key] = value
    }
  }
  return base
}

export function shouldPersistRunStreamReplay(taskType: string): boolean {
  return RUN_STREAM_REPLAY_PERSIST_TYPES.has(taskType)
}

export async function publishRunStartEventIfNeeded(params: {
  jobData: TaskJobData
  payload: Record<string, unknown>
}) {
  if (!shouldDirectPublishRunEvents(params.jobData.type)) return

  const runId = extractFlowFields(params.jobData).runId
  if (typeof runId !== 'string' || !runId.trim()) return

  await publishRunEvent({
    runId: runId.trim(),
    projectId: params.jobData.projectId,
    userId: params.jobData.userId,
    eventType: RUN_EVENT_TYPE.RUN_START,
    payload: params.payload,
  })
}

export async function publishLifecycleEvent(params: {
  taskId: string
  projectId: string
  userId: string
  type: typeof TASK_EVENT_TYPE[keyof typeof TASK_EVENT_TYPE]
  taskType: string
  targetType: string
  targetId: string
  episodeId?: string | null
  payload?: Record<string, unknown> | null
  persist?: boolean
}) {
  await publishTaskEvent({
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    type: params.type,
    taskType: params.taskType,
    targetType: params.targetType,
    targetId: params.targetId,
    episodeId: params.episodeId || null,
    payload: params.payload,
    persist: params.persist,
  })

  await publishMirroredRunEvents({
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    taskType: params.taskType,
    targetType: params.targetType,
    targetId: params.targetId,
    episodeId: params.episodeId || null,
    eventType: TASK_SSE_EVENT_TYPE.LIFECYCLE,
    payload: {
      ...params.payload,
      lifecycleType:
        params.type === TASK_EVENT_TYPE.PROGRESS
          ? TASK_EVENT_TYPE.PROCESSING
          : params.type,
    },
  })
}

export async function publishStreamEvent(params: {
  taskId: string
  projectId: string
  userId: string
  taskType: string
  targetType: string
  targetId: string
  episodeId?: string | null
  payload?: Record<string, unknown> | null
  persist?: boolean
}) {
  await publishTaskStreamEvent({
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    taskType: params.taskType,
    targetType: params.targetType,
    targetId: params.targetId,
    episodeId: params.episodeId || null,
    payload: params.payload,
    persist: params.persist,
  })

  await publishMirroredRunEvents({
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    taskType: params.taskType,
    targetType: params.targetType,
    targetId: params.targetId,
    episodeId: params.episodeId || null,
    eventType: TASK_SSE_EVENT_TYPE.STREAM,
    payload: params.payload,
  })
}
