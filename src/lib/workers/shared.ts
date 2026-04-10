import { UnrecoverableError, type Job } from 'bullmq'
import { createScopedLogger } from '@/lib/logging/core'
import type { LLMStreamChunk } from '@/lib/llm-observe/types'
import { TaskTerminatedError } from '@/lib/task/errors'
import {
  touchTaskHeartbeat,
  tryMarkTaskProcessing,
  tryUpdateTaskProgress,
} from '@/lib/task/service'
import { TASK_EVENT_TYPE, type TaskBillingInfo, type TaskJobData } from '@/lib/task/types'
import { buildTaskProgressMessage, getTaskStageLabel } from '@/lib/task/progress-message'
import { withTextUsageCollection } from '@/lib/billing/runtime-usage'
import {
  publishLifecycleEvent,
  publishStreamEvent,
  shouldPersistRunStreamReplay,
  withFlowFields,
} from './task-flow-events'
import {
  resolveProjectNameForLogging,
} from './task-lifecycle-helpers'
import {
  handleInactiveTaskStart,
  handleSuccessfulTaskCompletion,
  handleTerminatedTask,
  handleWorkerFailure,
  publishProcessingLifecycle,
} from './task-lifecycle-transitions'

function buildWorkerLogger(data: TaskJobData, queueName: string) {
  return createScopedLogger({
    module: `worker.${queueName}`,
    requestId: data.trace?.requestId || undefined,
    taskId: data.taskId,
    projectId: data.projectId,
    userId: data.userId,
  })
}

export async function withTaskLifecycle(job: Job<TaskJobData>, handler: (job: Job<TaskJobData>) => Promise<Record<string, unknown> | void>) {
  const data = job.data
  const taskId = data.taskId
  const logger = buildWorkerLogger(data, job.queueName)
  const startedAt = Date.now()
  let billingInfo = (data.billingInfo || null) as TaskBillingInfo | null

  // Register project name for per-project log file routing
  void resolveProjectNameForLogging(data.projectId)

  const heartbeatTimer = setInterval(() => {
    void touchTaskHeartbeat(taskId)
  }, 10_000)

  try {
    logger.info({
      action: 'worker.start',
      message: 'worker started',
      details: {
        queue: job.queueName,
        taskType: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        episodeId: data.episodeId || null,
      },
    })
    const markedProcessing = await tryMarkTaskProcessing(taskId)
    if (!markedProcessing) {
      billingInfo = await handleInactiveTaskStart({
        taskId,
        billingInfo,
        logger,
      })
      return
    }
    await publishProcessingLifecycle({ job })

    const { result, textUsage } = await withTextUsageCollection(async () => await handler(job))
    const completed = await handleSuccessfulTaskCompletion({
      taskId,
      data,
      result: (result || undefined) as Record<string, unknown> | void,
      textUsage,
      billingInfo,
      logger,
      startedAt,
    })
    billingInfo = completed.billingInfo
    if (completed.skipped) return
  } catch (error: unknown) {
    if (error instanceof TaskTerminatedError) {
      await handleTerminatedTask({
        taskId,
        billingInfo,
        logger,
        startedAt,
        error,
      })
    }
    await handleWorkerFailure({
      job,
      taskId,
      data,
      error,
      billingInfo,
      logger,
      startedAt,
    })
  } finally {
    clearInterval(heartbeatTimer)
  }
}

export async function reportTaskProgress(job: Job<TaskJobData>, progress: number, payload?: Record<string, unknown>) {
  const value = Math.max(0, Math.min(99, Math.floor(progress)))
  const logger = buildWorkerLogger(job.data, job.queueName)
  const nextPayload: Record<string, unknown> = withFlowFields(job.data, payload)
  const stage = typeof nextPayload.stage === 'string' ? nextPayload.stage : null
  if (stage && typeof nextPayload.stageLabel !== 'string') {
    nextPayload.stageLabel = getTaskStageLabel(stage)
  }
  if (typeof nextPayload.displayMode !== 'string') {
    nextPayload.displayMode = 'loading'
  }
  if (typeof nextPayload.message !== 'string') {
    nextPayload.message = buildTaskProgressMessage({
      eventType: TASK_EVENT_TYPE.PROGRESS,
      taskType: job.data.type,
      progress: value,
      payload: nextPayload,
    })
  }

  logger.info({
    action: 'worker.progress',
    message: 'worker progress update',
    details: {
      progress: value,
      ...nextPayload,
    },
  })

  const updated = await tryUpdateTaskProgress(job.data.taskId, value, nextPayload)
  if (!updated) {
    return
  }
  await publishLifecycleEvent({
    taskId: job.data.taskId,
    projectId: job.data.projectId,
    userId: job.data.userId,
    type: TASK_EVENT_TYPE.PROGRESS,
    taskType: job.data.type,
    targetType: job.data.targetType,
    targetId: job.data.targetId,
    episodeId: job.data.episodeId || null,
    payload: {
      progress: value,
      ...nextPayload,
      trace: {
        requestId: job.data.trace?.requestId || null,
      },
    },
    persist: shouldPersistRunStreamReplay(job.data.type),
  })
}

export async function reportTaskStreamChunk(
  job: Job<TaskJobData>,
  chunk: LLMStreamChunk,
  payload?: Record<string, unknown>,
) {
  const mergedPayload: Record<string, unknown> = withFlowFields(job.data, {
    ...(payload || {}),
    displayMode: 'detail',
    stream: chunk,
    done: false,
    message: payload?.message || (chunk.kind === 'reasoning' ? 'progress.runtime.llm.reasoning' : 'progress.runtime.llm.output'),
  })

  await publishStreamEvent({
    taskId: job.data.taskId,
    projectId: job.data.projectId,
    userId: job.data.userId,
    taskType: job.data.type,
    targetType: job.data.targetType,
    targetId: job.data.targetId,
    episodeId: job.data.episodeId || null,
    payload: {
      ...mergedPayload,
      trace: {
        requestId: job.data.trace?.requestId || null,
      },
    },
    persist: shouldPersistRunStreamReplay(job.data.type),
  })
}
