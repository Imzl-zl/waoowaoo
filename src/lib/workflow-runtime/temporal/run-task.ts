import { activityInfo } from '@temporalio/activity'
import { ApplicationFailure } from '@temporalio/common'
import { UnrecoverableError, type Job } from 'bullmq'
import { getTaskById } from '@/lib/task/service'
import {
  TASK_STATUS,
  TASK_TYPE,
  type TaskBillingInfo,
  type TaskJobData,
  type TaskType,
} from '@/lib/task/types'
import { locales, type Locale } from '@/i18n/routing'
import { reportTaskProgress, withTaskLifecycle } from '@/lib/workers/shared'
import { resolveTextTaskHandler } from '@/lib/workers/handlers/text-task-router'
import { normalizeTemporalWorkflowRunInput } from './contract'
import type { TemporalTaskWorkflowResult, TemporalWorkflowRunInput } from './types'

const TEMPORAL_TEXT_QUEUE_NAME = 'temporal:text'
const TEMPORAL_TASK_MAX_ATTEMPTS = 5
const TEMPORAL_TASK_BACKOFF_MS = 2_000
const TEMPORAL_TASK_RECEIVED_PROGRESS = 5
const NON_RETRYABLE_TASK_FAILURE_TYPE = 'TASK_TERMINAL_FAILURE'
const RUN_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  TASK_TYPE.STORY_TO_SCRIPT_RUN,
  TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
])

type TaskRow = NonNullable<Awaited<ReturnType<typeof getTaskById>>>

class NonRetryableTemporalTaskError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NonRetryableTemporalTaskError'
  }
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function isRunTaskType(value: string): value is TaskType {
  return RUN_TASK_TYPES.has(value as TaskType)
}

function normalizeLocaleValue(value: unknown): Locale | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  for (const locale of locales) {
    if (normalized === locale || normalized.startsWith(`${locale}-`)) return locale
  }
  return null
}

function resolvePayloadLocale(payload: Record<string, unknown>): Locale {
  const meta = toObject(payload.meta)
  const locale = normalizeLocaleValue(meta.locale) || normalizeLocaleValue(payload.locale)
  if (!locale) throw new NonRetryableTemporalTaskError('task locale is missing')
  return locale
}

function requireMatchingField(label: string, taskValue: string | null, workflowValue?: string | null) {
  const normalizedWorkflow = workflowValue?.trim() || null
  if (!normalizedWorkflow) return
  if (taskValue !== normalizedWorkflow) {
    throw new NonRetryableTemporalTaskError(`${label} does not match workflow input`)
  }
}

function requireWorkflowTaskId(input: TemporalWorkflowRunInput): string {
  const taskId = input.taskId?.trim() || ''
  if (!taskId) throw new NonRetryableTemporalTaskError('taskId is required for run task workflow')
  return taskId
}

function resolvePayloadRunId(payload: Record<string, unknown>): string | null {
  const direct = readString(payload, 'runId')
  if (direct) return direct
  return readString(toObject(payload.meta), 'runId')
}

function assertWorkflowTaskType(workflow: TemporalWorkflowRunInput, taskType: TaskType) {
  if (workflow.workflowType !== taskType) {
    throw new NonRetryableTemporalTaskError('task type does not match workflow input')
  }
}

function buildTaskTerminalMessage(task: TaskRow): string {
  const message = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : ''
  return message ? `task ended with status ${task.status}: ${message}` : `task ended with status ${task.status}`
}

async function assertTaskCompleted(taskId: string): Promise<void> {
  const task = await getTaskById(taskId)
  if (!task) throw new NonRetryableTemporalTaskError('task not found after lifecycle')
  if (task.status === TASK_STATUS.COMPLETED) return
  if (
    task.status === TASK_STATUS.FAILED ||
    task.status === TASK_STATUS.CANCELED ||
    task.status === TASK_STATUS.DISMISSED
  ) {
    throw new NonRetryableTemporalTaskError(buildTaskTerminalMessage(task))
  }
  throw new Error(`task lifecycle ended without completion: ${task.status}`)
}

export function createTemporalTaskJob(data: TaskJobData, attempt: number): Job<TaskJobData> {
  const attemptsMade = Math.max(0, Math.floor(attempt) - 1)
  return {
    id: data.taskId,
    name: data.type,
    queueName: TEMPORAL_TEXT_QUEUE_NAME,
    data,
    attemptsMade,
    opts: {
      attempts: TEMPORAL_TASK_MAX_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: TEMPORAL_TASK_BACKOFF_MS,
      },
    },
  } as unknown as Job<TaskJobData>
}

export function buildTaskJobDataFromTask(
  workflow: TemporalWorkflowRunInput,
  task: TaskRow,
): TaskJobData {
  const taskId = requireWorkflowTaskId(workflow)
  if (task.id !== taskId) {
    throw new NonRetryableTemporalTaskError('taskId does not match workflow input')
  }
  if (!isRunTaskType(task.type)) {
    throw new NonRetryableTemporalTaskError(`unsupported Temporal run task type: ${task.type}`)
  }
  assertWorkflowTaskType(workflow, task.type)

  const payload = toObject(task.payload)
  const runId = resolvePayloadRunId(payload)
  if (runId !== workflow.runId) {
    throw new NonRetryableTemporalTaskError('task payload runId does not match workflow runId')
  }
  requireMatchingField('userId', task.userId, workflow.userId)
  requireMatchingField('projectId', task.projectId, workflow.projectId)
  requireMatchingField('targetType', task.targetType, workflow.targetType)
  requireMatchingField('targetId', task.targetId, workflow.targetId)
  requireMatchingField('episodeId', task.episodeId, workflow.episodeId)

  return {
    taskId: task.id,
    type: task.type,
    locale: resolvePayloadLocale(payload),
    projectId: task.projectId,
    episodeId: task.episodeId || null,
    targetType: task.targetType,
    targetId: task.targetId,
    payload,
    billingInfo: (task.billingInfo || null) as TaskBillingInfo | null,
    userId: task.userId,
    trace: null,
  }
}

function buildTemporalTaskWorkflowResult(params: {
  workflow: TemporalWorkflowRunInput
  task: TaskJobData
  activityId: string
}): TemporalTaskWorkflowResult {
  return {
    runId: params.workflow.runId,
    workflowType: params.workflow.workflowType,
    taskId: params.task.taskId,
    taskType: params.task.type,
    status: 'completed',
    activityId: params.activityId,
  }
}

function toNonRetryableActivityFailure(error: unknown): ApplicationFailure | null {
  if (
    error instanceof NonRetryableTemporalTaskError ||
    error instanceof UnrecoverableError ||
    (error instanceof Error && error.name === 'UnrecoverableError')
  ) {
    return ApplicationFailure.nonRetryable(
      error.message || 'Temporal run task failed',
      NON_RETRYABLE_TASK_FAILURE_TYPE,
    )
  }
  return null
}

export const taskActivities = {
  async executeRunCentricTask(
    input: TemporalWorkflowRunInput,
  ): Promise<TemporalTaskWorkflowResult> {
    const current = activityInfo()
    try {
      const workflow = normalizeTemporalWorkflowRunInput(input)
      const taskRow = await getTaskById(requireWorkflowTaskId(workflow))
      if (!taskRow) throw new NonRetryableTemporalTaskError('task not found')
      const task = buildTaskJobDataFromTask(workflow, taskRow)
      const job = createTemporalTaskJob(task, current.attempt)
      await withTaskLifecycle(job, async (nextJob) => {
        await reportTaskProgress(nextJob, TEMPORAL_TASK_RECEIVED_PROGRESS, { stage: 'received' })
        return await resolveTextTaskHandler(nextJob.data.type)(nextJob)
      })
      await assertTaskCompleted(task.taskId)
      return buildTemporalTaskWorkflowResult({
        workflow,
        task,
        activityId: current.activityId,
      })
    } catch (error) {
      throw toNonRetryableActivityFailure(error) || error
    }
  },
}
