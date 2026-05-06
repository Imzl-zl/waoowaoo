import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { TASK_EVENT_TYPE, TASK_STATUS, TASK_TYPE } from '@/lib/task/types'

const serviceMock = vi.hoisted(() => ({
  createTask: vi.fn(),
  getTaskById: vi.fn(),
  markTaskEnqueueFailed: vi.fn(),
  markTaskEnqueued: vi.fn(),
  markTaskFailed: vi.fn(),
  rollbackTaskBillingForTask: vi.fn(),
  updateTaskBillingInfo: vi.fn(),
  updateTaskPayload: vi.fn(),
}))

const publisherMock = vi.hoisted(() => ({
  publishTaskEvent: vi.fn(),
}))

const billingMock = vi.hoisted(() => ({
  buildDefaultTaskBillingInfo: vi.fn(),
  getBillingMode: vi.fn(),
  InsufficientBalanceError: class InsufficientBalanceError extends Error {},
  isBillableTaskType: vi.fn(),
  prepareTaskBilling: vi.fn(),
}))

const flowMetaMock = vi.hoisted(() => ({
  getTaskFlowMeta: vi.fn(),
}))

const runRuntimeMock = vi.hoisted(() => ({
  attachTaskToRun: vi.fn(),
  createRun: vi.fn(),
  findReusableActiveRun: vi.fn(),
}))

const workflowMock = vi.hoisted(() => ({
  isAiTaskType: vi.fn(),
  workflowTypeFromTaskType: vi.fn(),
}))

const launcherMock = vi.hoisted(() => ({
  launchTaskExecution: vi.fn(),
}))

vi.mock('@/lib/task/service', () => serviceMock)
vi.mock('@/lib/task/publisher', () => publisherMock)
vi.mock('@/lib/billing', () => billingMock)
vi.mock('@/lib/llm-observe/stage-pipeline', () => flowMetaMock)
vi.mock('@/lib/run-runtime/service', () => runRuntimeMock)
vi.mock('@/lib/run-runtime/workflow', () => workflowMock)
vi.mock('@/lib/task/execution-launcher', () => launcherMock)

function createQueuedTask() {
  return {
    id: 'task-1',
    status: TASK_STATUS.QUEUED,
    payload: { source: 'unit' },
    billingInfo: null,
    priority: 4,
  }
}

describe('submitTask execution launcher wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMock.createTask.mockResolvedValue({
      task: createQueuedTask(),
      deduped: false,
    })
    serviceMock.getTaskById.mockResolvedValue(null)
    serviceMock.markTaskEnqueued.mockResolvedValue({})
    serviceMock.markTaskEnqueueFailed.mockResolvedValue({})
    serviceMock.markTaskFailed.mockResolvedValue({})
    serviceMock.rollbackTaskBillingForTask.mockResolvedValue({
      attempted: false,
      rolledBack: true,
      billingInfo: null,
    })
    serviceMock.updateTaskPayload.mockResolvedValue({})
    publisherMock.publishTaskEvent.mockResolvedValue({})
    billingMock.buildDefaultTaskBillingInfo.mockReturnValue(null)
    billingMock.getBillingMode.mockResolvedValue('OFF')
    billingMock.isBillableTaskType.mockReturnValue(false)
    billingMock.prepareTaskBilling.mockResolvedValue(null)
    flowMetaMock.getTaskFlowMeta.mockReturnValue({
      flowId: 'story-to-script',
      flowStageTitle: 'Story to script',
      flowStageIndex: 1,
      flowStageTotal: 1,
    })
    runRuntimeMock.attachTaskToRun.mockResolvedValue({})
    runRuntimeMock.createRun.mockResolvedValue({ id: 'run-1' })
    runRuntimeMock.findReusableActiveRun.mockResolvedValue(null)
    workflowMock.isAiTaskType.mockReturnValue(true)
    workflowMock.workflowTypeFromTaskType.mockImplementation((type: string) => type)
    launcherMock.launchTaskExecution.mockResolvedValue({
      runtime: 'bullmq',
      externalId: 'job-1',
    })
  })

  it('delegates non-deduped task startup to launchTaskExecution', async () => {
    const result = await submitTask({
      userId: 'user-1',
      locale: 'zh',
      projectId: 'project-1',
      episodeId: 'episode-1',
      type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      targetType: 'NovelPromotionEpisode',
      targetId: 'episode-1',
      payload: { source: 'unit' },
      requestId: 'request-1',
    })

    expect(result).toMatchObject({
      success: true,
      taskId: 'task-1',
      runId: 'run-1',
    })
    expect(launcherMock.launchTaskExecution).toHaveBeenCalledWith({
      task: expect.objectContaining({
        taskId: 'task-1',
        type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
        payload: expect.objectContaining({
          runId: 'run-1',
          meta: expect.objectContaining({ runId: 'run-1' }),
        }),
      }),
      runId: 'run-1',
      workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      priority: 4,
    })
    expect(serviceMock.markTaskEnqueued).toHaveBeenCalledWith('task-1')
  })

  it('preserves explicit launcher ApiError codes while running compensation', async () => {
    launcherMock.launchTaskExecution.mockRejectedValueOnce(
      new ApiError('INVALID_PARAMS', { message: 'unsupported runtime task type' }),
    )

    await expect(submitTask({
      userId: 'user-1',
      locale: 'zh',
      projectId: 'project-1',
      episodeId: 'episode-1',
      type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      targetType: 'NovelPromotionEpisode',
      targetId: 'episode-1',
      payload: { source: 'unit' },
    })).rejects.toMatchObject({ code: 'INVALID_PARAMS' })

    expect(serviceMock.markTaskEnqueueFailed).toHaveBeenCalledWith(
      'task-1',
      'unsupported runtime task type',
    )
    expect(serviceMock.rollbackTaskBillingForTask).toHaveBeenCalledWith({
      taskId: 'task-1',
      billingInfo: null,
    })
    expect(serviceMock.markTaskFailed).toHaveBeenCalledWith(
      'task-1',
      'INVALID_PARAMS',
      'unsupported runtime task type',
    )
    expect(publisherMock.publishTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: TASK_EVENT_TYPE.FAILED,
      payload: expect.objectContaining({ errorCode: 'INVALID_PARAMS' }),
    }))
  })
})
