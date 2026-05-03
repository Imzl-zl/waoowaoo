import { UnrecoverableError } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_STATUS, TASK_TYPE } from '@/lib/task/types'

const activityInfoMock = vi.hoisted(() => vi.fn(() => ({
  activityId: 'activity-1',
  attempt: 2,
})))
const getTaskByIdMock = vi.hoisted(() => vi.fn())
const reportTaskProgressMock = vi.hoisted(() => vi.fn(async () => undefined))
const withTaskLifecycleMock = vi.hoisted(() => vi.fn())
const resolveTextTaskHandlerMock = vi.hoisted(() => vi.fn())

vi.mock('@temporalio/activity', () => ({
  activityInfo: activityInfoMock,
}))

vi.mock('@/lib/task/service', () => ({
  getTaskById: getTaskByIdMock,
}))

vi.mock('@/lib/workers/shared', () => ({
  reportTaskProgress: reportTaskProgressMock,
  withTaskLifecycle: withTaskLifecycleMock,
}))

vi.mock('@/lib/workers/handlers/text-task-router', () => ({
  resolveTextTaskHandler: resolveTextTaskHandlerMock,
}))

import {
  buildTaskJobDataFromTask,
  createTemporalTaskJob,
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
    reportTaskProgressMock.mockReset()
    withTaskLifecycleMock.mockReset()
    resolveTextTaskHandlerMock.mockReset()
    getTaskByIdMock
      .mockResolvedValueOnce(buildTaskRow())
      .mockResolvedValue(buildTaskRow({ status: TASK_STATUS.COMPLETED }))
    const handler = vi.fn(async () => ({ ok: true }))
    resolveTextTaskHandlerMock.mockReturnValue(handler)
    withTaskLifecycleMock.mockImplementation(async (job, handlerFn) => await handlerFn(job))
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

  it('creates a BullMQ-compatible job shell with Temporal attempt state', () => {
    const job = createTemporalTaskJob(buildTaskJobDataFromTask(workflow, buildTaskRow()), 3)

    expect(job).toMatchObject({
      id: 'task-1',
      name: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      queueName: 'temporal:text',
      attemptsMade: 2,
      opts: {
        attempts: 5,
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
    expect(resolveTextTaskHandlerMock).toHaveBeenCalledWith(TASK_TYPE.STORY_TO_SCRIPT_RUN)
    expect(withTaskLifecycleMock).toHaveBeenCalledTimes(1)
    const job = withTaskLifecycleMock.mock.calls[0]?.[0]
    expect(job).toMatchObject({
      queueName: 'temporal:text',
      attemptsMade: 1,
      data: {
        taskId: 'task-1',
        type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      },
    })
    expect(reportTaskProgressMock).toHaveBeenCalledWith(job, 5, { stage: 'received' })
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
    expect(withTaskLifecycleMock).not.toHaveBeenCalled()
  })

  it('rejects workflow type mismatches as non-retryable Activity failures', async () => {
    await expect(taskActivities.executeRunCentricTask({
      ...workflow,
      workflowType: TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
    })).rejects.toMatchObject({
      nonRetryable: true,
      type: 'TASK_TERMINAL_FAILURE',
    })
    expect(withTaskLifecycleMock).not.toHaveBeenCalled()
  })

  it('converts terminal worker lifecycle failures to non-retryable Activity failures', async () => {
    withTaskLifecycleMock.mockRejectedValue(new UnrecoverableError('terminal failure'))

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
