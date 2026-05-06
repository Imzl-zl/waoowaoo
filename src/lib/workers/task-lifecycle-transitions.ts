import { UnrecoverableError } from 'bullmq'
import { rollbackTaskBilling, settleTaskBilling } from '@/lib/billing'
import type { TextUsageEntry } from '@/lib/billing/runtime-usage'
import type { NormalizedError } from '@/lib/errors/types'
import { normalizeAnyError } from '@/lib/errors/normalize'
import {
  rollbackTaskBillingForTask,
  tryMarkTaskCompleted,
  tryMarkTaskFailed,
  updateTaskBillingInfo,
} from '@/lib/task/service'
import { buildTaskProgressMessage, getTaskStageLabel } from '@/lib/task/progress-message'
import { TASK_EVENT_TYPE, type TaskBillingInfo, type TaskJobData } from '@/lib/task/types'
import {
  type TaskRetryState,
  buildErrorCauseChain,
  shouldRetryInQueue,
} from './task-lifecycle-helpers'
import {
  publishLifecycleEvent,
  publishRunStartEventIfNeeded,
  withFlowFields,
} from './task-flow-events'

type WorkerLogger = {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export async function handleInactiveTaskStart(params: {
  taskId: string
  billingInfo: TaskBillingInfo | null
  logger: WorkerLogger
}) {
  let billingInfo = params.billingInfo
  const rollbackResult = await rollbackTaskBillingForTask({
    taskId: params.taskId,
    billingInfo,
  })
  if (rollbackResult.billingInfo) {
    billingInfo = rollbackResult.billingInfo
  }
  if (rollbackResult.attempted && !rollbackResult.rolledBack) {
    params.logger.error({
      action: 'worker.skip.terminated.rollback_failed',
      message: 'task is terminal and billing rollback failed',
      errorCode: 'BILLING_COMPENSATION_FAILED',
    })
  }
  params.logger.info({
    action: 'worker.skip.terminated',
    message: 'task is not active, skip worker execution',
  })

  return billingInfo
}

export async function publishProcessingLifecycle(params: {
  taskId: string
  data: TaskJobData
  queueName: string
}) {
  const processingPayload = withFlowFields(params.data, {
    queue: params.queueName,
    stage: 'received',
    stageLabel: getTaskStageLabel('received'),
    displayMode: 'loading',
    trace: {
      requestId: params.data.trace?.requestId || null,
    },
  })
  const processingMessage = buildTaskProgressMessage({
    eventType: TASK_EVENT_TYPE.PROCESSING,
    taskType: params.data.type,
    payload: processingPayload,
  })

  await publishRunStartEventIfNeeded({
    jobData: params.data,
    payload: {
      ...processingPayload,
      message: processingMessage,
    },
  })
  await publishLifecycleEvent({
    taskId: params.taskId,
    projectId: params.data.projectId,
    userId: params.data.userId,
    type: TASK_EVENT_TYPE.PROCESSING,
    taskType: params.data.type,
    targetType: params.data.targetType,
    targetId: params.data.targetId,
    episodeId: params.data.episodeId || null,
    payload: {
      ...processingPayload,
      message: processingMessage,
    },
  })
}

export async function handleSuccessfulTaskCompletion(params: {
  taskId: string
  data: TaskJobData
  result: Record<string, unknown> | void
  textUsage: TextUsageEntry[]
  billingInfo: TaskBillingInfo | null
  logger: WorkerLogger
  startedAt: number
}) {
  let billingInfo = params.billingInfo
  if (billingInfo?.billable) {
    billingInfo = (await settleTaskBilling({
      id: params.taskId,
      projectId: params.data.projectId,
      userId: params.data.userId,
      billingInfo,
    }, {
      result: (params.result || undefined) as Record<string, unknown> | void,
      textUsage: params.textUsage,
    })) as TaskBillingInfo
    await updateTaskBillingInfo(params.taskId, billingInfo)
  }

  const markedCompleted = await tryMarkTaskCompleted(params.taskId, params.result || null)
  if (!markedCompleted) {
    params.logger.info({
      action: 'worker.skip.completed',
      message: 'task already terminal, skip completed event',
      durationMs: Date.now() - params.startedAt,
    })
    return { billingInfo, skipped: true as const }
  }

  params.logger.info({
    action: 'worker.completed',
    message: 'worker completed',
    durationMs: Date.now() - params.startedAt,
    details: params.result || null,
  })
  const completedPayload = withFlowFields(params.data, {
    ...(params.result || {}),
    displayMode: 'loading',
    trace: {
      requestId: params.data.trace?.requestId || null,
    },
  })
  await publishLifecycleEvent({
    taskId: params.taskId,
    projectId: params.data.projectId,
    userId: params.data.userId,
    type: TASK_EVENT_TYPE.COMPLETED,
    taskType: params.data.type,
    targetType: params.data.targetType,
    targetId: params.data.targetId,
    episodeId: params.data.episodeId || null,
    payload: {
      ...completedPayload,
      message: buildTaskProgressMessage({
        eventType: TASK_EVENT_TYPE.COMPLETED,
        taskType: params.data.type,
        payload: completedPayload,
      }),
    },
  })

  return { billingInfo, skipped: false as const }
}

export async function handleTerminatedTask(params: {
  taskId: string
  billingInfo: TaskBillingInfo | null
  logger: WorkerLogger
  startedAt: number
  error: Error
}) {
  if (params.billingInfo?.billable) {
    const nextBillingInfo = (await rollbackTaskBilling({
      id: params.taskId,
      billingInfo: params.billingInfo,
    })) as TaskBillingInfo
    await updateTaskBillingInfo(params.taskId, nextBillingInfo)
  }
  params.logger.info({
    action: 'worker.terminated',
    message: params.error.message,
    durationMs: Date.now() - params.startedAt,
  })
  throw new UnrecoverableError(`Task terminated: ${params.error.message}`)
}

export async function handleWorkerFailure(params: {
  retryState: TaskRetryState
  queueName: string
  taskId: string
  data: TaskJobData
  error: unknown
  billingInfo: TaskBillingInfo | null
  logger: WorkerLogger
  startedAt: number
}) {
  const normalizedError = normalizeAnyError(params.error, { context: 'worker' })
  const retryDecision = shouldRetryInQueue({
    retryState: params.retryState,
    normalizedError,
  })
  const errorCauseChain = buildErrorCauseChain(params.error)
  const workerFailureLog = buildWorkerFailureLog({
    data: params.data,
    error: params.error,
    normalizedError,
    errorCauseChain,
    durationMs: Date.now() - params.startedAt,
    queueName: params.queueName,
  })

  if (retryDecision.enabled) {
    params.logger.error({
      ...workerFailureLog,
      action: 'worker.failed.retryable',
      message: `retryable failure: ${normalizedError.message}`,
    })
    await publishRetryLifecycle({
      taskId: params.taskId,
      data: params.data,
      normalizedError,
      retryDecision,
      logger: params.logger,
      queueName: params.queueName,
      startedAt: params.startedAt,
    })
    throw (params.error instanceof Error ? params.error : new Error(normalizedError.message || 'Task failed'))
  }

  params.logger.error(workerFailureLog)
  await handleTerminalFailure({
    taskId: params.taskId,
    data: params.data,
    error: params.error,
    normalizedError,
    billingInfo: params.billingInfo,
  })
}

function buildWorkerFailureLog(params: {
  data: TaskJobData
  error: unknown
  normalizedError: NormalizedError
  errorCauseChain: Array<{ name: string; message: string }>
  durationMs: number
  queueName: string
}) {
  return {
    action: 'worker.failed',
    message: params.normalizedError.message,
    errorCode: params.normalizedError.code,
    retryable: params.normalizedError.retryable,
    provider: params.normalizedError.provider || undefined,
    durationMs: params.durationMs,
    details: {
      queue: params.queueName,
      taskType: params.data.type,
      targetType: params.data.targetType,
      targetId: params.data.targetId,
    },
    error:
      params.error instanceof Error
        ? {
          name: params.error.name,
          message: params.error.message,
          stack: params.error.stack,
          code: params.normalizedError.code,
          retryable: params.normalizedError.retryable,
          causeChain: params.errorCauseChain,
        }
        : {
          message: String(params.error),
          code: params.normalizedError.code,
          retryable: params.normalizedError.retryable,
          causeChain: params.errorCauseChain,
        },
  }
}

async function publishRetryLifecycle(params: {
  taskId: string
  data: TaskJobData
  normalizedError: NormalizedError
  retryDecision: {
    failedAttempt: number
    maxAttempts: number
    nextBackoffMs: number | null
  }
  logger: WorkerLogger
  queueName: string
  startedAt: number
}) {
  params.logger.error({
    action: 'worker.retry.scheduled',
    message: 'retryable worker error, queue retry scheduled',
    errorCode: params.normalizedError.code,
    retryable: params.normalizedError.retryable,
    durationMs: Date.now() - params.startedAt,
    details: {
      queue: params.queueName,
      taskType: params.data.type,
      targetType: params.data.targetType,
      targetId: params.data.targetId,
      failedAttempt: params.retryDecision.failedAttempt,
      maxAttempts: params.retryDecision.maxAttempts,
      nextBackoffMs: params.retryDecision.nextBackoffMs,
    },
  })

  const retryPayload = withFlowFields(params.data, {
    stage: 'retrying',
    stageLabel: 'progress.runtime.stage.retrying',
    displayMode: 'detail',
    error: params.normalizedError,
    retry: {
      failedAttempt: params.retryDecision.failedAttempt,
      maxAttempts: params.retryDecision.maxAttempts,
      nextBackoffMs: params.retryDecision.nextBackoffMs,
    },
    trace: {
      requestId: params.data.trace?.requestId || null,
    },
  })

  try {
    await publishLifecycleEvent({
      taskId: params.taskId,
      projectId: params.data.projectId,
      userId: params.data.userId,
      type: TASK_EVENT_TYPE.PROGRESS,
      taskType: params.data.type,
      targetType: params.data.targetType,
      targetId: params.data.targetId,
      episodeId: params.data.episodeId || null,
      payload: {
        ...retryPayload,
        message: `Retry scheduled (${params.retryDecision.failedAttempt}/${params.retryDecision.maxAttempts}): ${params.normalizedError.message}`,
      },
      persist: false,
    })
  } catch (publishError) {
    params.logger.warn({
      action: 'worker.retry.progress_publish_failed',
      message: 'failed to publish retry progress event',
      details: {
        queue: params.queueName,
        taskType: params.data.type,
        taskId: params.taskId,
      },
      error: publishError instanceof Error ? publishError.message : String(publishError),
    })
  }
}

async function handleTerminalFailure(params: {
  taskId: string
  data: TaskJobData
  error: unknown
  normalizedError: NormalizedError
  billingInfo: TaskBillingInfo | null
}) {
  if (params.billingInfo?.billable) {
    const nextBillingInfo = (await rollbackTaskBilling({
      id: params.taskId,
      billingInfo: params.billingInfo,
    })) as TaskBillingInfo
    await updateTaskBillingInfo(params.taskId, nextBillingInfo)
  }

  const markedFailed = await tryMarkTaskFailed(
    params.taskId,
    params.normalizedError.code,
    params.normalizedError.message,
  )
  if (!markedFailed) {
    throw new UnrecoverableError('task already terminal')
  }

  const failedPayload = withFlowFields(params.data, {
    error: params.normalizedError,
    displayMode: 'loading',
    trace: {
      requestId: params.data.trace?.requestId || null,
    },
  }) as Record<string, unknown>
  if (process.env.NODE_ENV !== 'production' && params.error instanceof Error && typeof params.error.stack === 'string') {
    failedPayload.errorStack = params.error.stack.slice(0, 8000)
  }

  await publishLifecycleEvent({
    taskId: params.taskId,
    projectId: params.data.projectId,
    userId: params.data.userId,
    type: TASK_EVENT_TYPE.FAILED,
    taskType: params.data.type,
    targetType: params.data.targetType,
    targetId: params.data.targetId,
    episodeId: params.data.episodeId || null,
    payload: {
      ...failedPayload,
      message: params.normalizedError.message || buildTaskProgressMessage({
        eventType: TASK_EVENT_TYPE.FAILED,
        taskType: params.data.type,
        payload: failedPayload,
      }),
    },
  })

  throw new UnrecoverableError(params.normalizedError.message || 'Task failed')
}
