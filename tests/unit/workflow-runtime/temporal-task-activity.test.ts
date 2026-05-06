import { UnrecoverableError } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_STATUS, TASK_TYPE } from '@/lib/task/types'

const activityInfoMock = vi.hoisted(() => vi.fn(() => ({
  activityId: 'activity-1',
  attempt: 2,
})))
const getTaskByIdMock = vi.hoisted(() => vi.fn())
const reportTaskProgressContextMock = vi.hoisted(() => vi.fn(async () => undefined))
const withTaskLifecycleContextMock = vi.hoisted(() => vi.fn())
const runTextTaskHandlerWithContextMock = vi.hoisted(() => vi.fn())

vi.mock('@temporalio/activity', () => ({
  activityInfo: activityInfoMock,
}))

vi.mock('@/lib/task/service', () => ({
  getTaskById: getTaskByIdMock,
}))

vi.mock('@/lib/workers/shared', () => ({
  reportTaskProgressContext: reportTaskProgressContextMock,
  withTaskLifecycleContext: withTaskLifecycleContextMock,
}))

vi.mock('@/lib/workers/handlers/text-task-router', () => ({
  runTextTaskHandlerWithContext: runTextTaskHandlerWithContextMock,
}))

import {
  buildTaskJobDataFromTask,
  createTemporalTaskExecutionContext,
  taskActivities,
} from '@/lib/workflow-runtime/temporal/run-task'

type TaskRow = Parameters<typeof buildTaskJobDataFromTask>[1]

const workflow = {
  runId: 'run-1',
  workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
  projectId: 'project-1',
  userId: 'user-1',
  episodeId: 'episode-1',
  taskId: 'task-1',
  targetType: 'NovelPromotionEpisode',
  targetId: 'episode-1',
  payload: { runId: 'run-1' },
}

function buildTaskRow(overrides: Partial<TaskRow> = {}): TaskRow {
  const now = new Date('2026-05-02T00:00:00.000Z')
  return {
    id: 'task-1',
    userId: 'user-1',
    projectId: 'project-1',
    episodeId: 'episode-1',
    type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
    targetType: 'NovelPromotionEpisode',
    targetId: 'episode-1',
    status: 'queued',
    progress: 0,
    payload: {
      runId: 'run-1',
      meta: {
        locale: 'zh',
        runId: 'run-1',
      },
    },
    result: null,
    billingInfo: null,
    billedAt: null,
    priority: 0,
    maxAttempts: 5,
    attempt: 0,
    dedupeKey: null,
    queuedAt: now,
    enqueuedAt: null,
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    externalId: null,
    errorCode: null,
    errorMessage: null,
    enqueueAttempts: 0,
    lastEnqueueError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('Temporal run task Activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTaskByIdMock.mockReset()
    reportTaskProgressContextMock.mockReset()
    withTaskLifecycleContextMock.mockReset()
    runTextTaskHandlerWithContextMock.mockReset()
    getTaskByIdMock
      .mockResolvedValueOnce(buildTaskRow())
      .mockResolvedValue(buildTaskRow({ status: TASK_STATUS.COMPLETED }))
    runTextTaskHandlerWithContextMock.mockResolvedValue({ ok: true })
    withTaskLifecycleContextMock.mockImplementation(
      async (context, handlerFn) => await handlerFn(context),
    )
  })

  it('rebuilds TaskJobData from the persisted task row', () => {
    const jobData = buildTaskJobDataFromTask(workflow, buildTaskRow())

    expect(jobData).toMatchObject({
      taskId: 'task-1',
      type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      locale: 'zh',
      projectId: 'project-1',
      episodeId: 'episode-1',
      targetType: 'NovelPromotionEpisode',
      targetId: 'episode-1',
      userId: 'user-1',
      payload: {
        runId: 'run-1',
      },
    })
  })

  it('creates a task execution context with Temporal retry state', () => {
    const context = createTemporalTaskExecutionContext(
      buildTaskJobDataFromTask(workflow, buildTaskRow()),
      3,
    )

    expect(context).toMatchObject({
      queueName: 'temporal:text',
      retryState: {
        attemptsMade: 2,
        maxAttempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    })
  })

  it('runs the existing text handler through worker lifecycle', async () => {
    const result = await taskActivities.executeRunCentricTask(workflow)

    expect(getTaskByIdMock).toHaveBeenCalledWith('task-1')
    expect(withTaskLifecycleContextMock).toHaveBeenCalledTimes(1)
    const context = withTaskLifecycleContextMock.mock.calls[0]?.[0]
    expect(context).toMatchObject({
      queueName: 'temporal:text',
      retryState: {
        attemptsMade: 1,
      },
      data: {
        taskId: 'task-1',
        type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      },
    })
    expect(reportTaskProgressContextMock).toHaveBeenCalledWith(context, 5, { stage: 'received' })
    expect(runTextTaskHandlerWithContextMock).toHaveBeenCalledWith(context)
    expect(result).toEqual({
      runId: 'run-1',
      workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      taskId: 'task-1',
      taskType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      status: 'completed',
      activityId: 'activity-1',
    })
  })

  it('rejects unsupported task types as non-retryable Activity failures', async () => {
    getTaskByIdMock.mockReset()
    getTaskByIdMock.mockResolvedValue(buildTaskRow({ type: TASK_TYPE.IMAGE_PANEL }))

    await expect(taskActivities.executeRunCentricTask(workflow)).rejects.toMatchObject({
      nonRetryable: true,
      type: 'TASK_TERMINAL_FAILURE',
    })
    expect(withTaskLifecycleContextMock).not.toHaveBeenCalled()
  })

  it('rejects workflow type mismatches as non-retryable Activity failures', async () => {
    await expect(taskActivities.executeRunCentricTask({
      ...workflow,
      workflowType: TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
    })).rejects.toMatchObject({
      nonRetryable: true,
      type: 'TASK_TERMINAL_FAILURE',
    })
    expect(withTaskLifecycleContextMock).not.toHaveBeenCalled()
  })

  it('converts terminal worker lifecycle failures to non-retryable Activity failures', async () => {
    withTaskLifecycleContextMock.mockRejectedValue(new UnrecoverableError('terminal failure'))

    await expect(taskActivities.executeRunCentricTask(workflow)).rejects.toMatchObject({
      nonRetryable: true,
      type: 'TASK_TERMINAL_FAILURE',
    })
  })

  it('rejects terminal task state after worker lifecycle as non-retryable', async () => {
    getTaskByIdMock.mockReset()
    getTaskByIdMock
      .mockResolvedValueOnce(buildTaskRow())
      .mockResolvedValueOnce(buildTaskRow({
        status: TASK_STATUS.FAILED,
        errorMessage: 'handler failed',
      }))

    await expect(taskActivities.executeRunCentricTask(workflow)).rejects.toMatchObject({
      nonRetryable: true,
      type: 'TASK_TERMINAL_FAILURE',
    })
  })
})
