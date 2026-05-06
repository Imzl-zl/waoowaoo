import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-errors'
import {
  buildTemporalRunTaskInput,
  launchTaskExecution,
  TASK_EXECUTION_RUNTIME,
} from '@/lib/task/execution-launcher'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'
import { TEMPORAL_WORKFLOW_TYPE } from '@/lib/workflow-runtime/temporal/types'

function buildTask(overrides: Partial<TaskJobData> = {}): TaskJobData {
  return {
    taskId: 'task-1',
    type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
    locale: 'zh',
    projectId: 'project-1',
    episodeId: 'episode-1',
    targetType: 'NovelPromotionEpisode',
    targetId: 'episode-1',
    payload: {
      episodeId: 'episode-1',
      runId: 'run-1',
      meta: { locale: 'zh', runId: 'run-1' },
    },
    billingInfo: null,
    userId: 'user-1',
    trace: { requestId: 'request-1' },
    ...overrides,
  }
}

describe('task execution launcher', () => {
  it('uses BullMQ by default', async () => {
    const addJob = vi.fn(async () => ({ id: 'job-1' }))

    const result = await launchTaskExecution({
      task: buildTask({ type: TASK_TYPE.VOICE_LINE }),
      runId: null,
      workflowType: TASK_TYPE.VOICE_LINE,
      priority: 7,
    }, { addJob })

    expect(addJob).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      type: TASK_TYPE.VOICE_LINE,
    }), { priority: 7 })
    expect(result).toEqual({
      runtime: TASK_EXECUTION_RUNTIME.BULLMQ,
      externalId: 'job-1',
    })
  })

  it('builds Temporal run-task input from task submission context', () => {
    const input = buildTemporalRunTaskInput({
      task: buildTask(),
      runId: 'run-1',
      workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      priority: 0,
    })

    expect(input).toEqual({
      runId: 'run-1',
      workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      projectId: 'project-1',
      userId: 'user-1',
      episodeId: 'episode-1',
      taskId: 'task-1',
      targetType: 'NovelPromotionEpisode',
      targetId: 'episode-1',
      payload: {
        episodeId: 'episode-1',
        runId: 'run-1',
        meta: { locale: 'zh', runId: 'run-1' },
      },
    })
  })

  it('launches supported run-centric text tasks through Temporal when explicit', async () => {
    const launchWorkflow = vi.fn(async () => ({
      start: {
        runId: 'run-1',
        workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
        temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.RUN_TASK,
        workflowId: 'waoowaoo-run-run-1',
        firstExecutionRunId: 'temporal-run-1',
        taskQueue: 'waoowaoo-workflows',
      },
      recorded: { id: 'run-1' },
    }))

    const result = await launchTaskExecution({
      task: buildTask(),
      runId: 'run-1',
      workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      priority: 0,
    }, {
      runtime: TASK_EXECUTION_RUNTIME.TEMPORAL_RUN_TASK,
      launchWorkflow,
    })

    expect(launchWorkflow).toHaveBeenCalledWith({
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.RUN_TASK,
      input: expect.objectContaining({
        runId: 'run-1',
        workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
        taskId: 'task-1',
      }),
    })
    expect(result).toEqual({
      runtime: TASK_EXECUTION_RUNTIME.TEMPORAL_RUN_TASK,
      externalId: 'waoowaoo-run-run-1',
    })
  })

  it('rejects unsupported task types in explicit Temporal runtime', async () => {
    await expect(launchTaskExecution({
      task: buildTask({ type: TASK_TYPE.VOICE_LINE }),
      runId: 'run-1',
      workflowType: TASK_TYPE.VOICE_LINE,
      priority: 0,
    }, {
      runtime: TASK_EXECUTION_RUNTIME.TEMPORAL_RUN_TASK,
      launchWorkflow: vi.fn(),
    })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    } satisfies Pick<ApiError, 'code'>)
  })

  it('rejects Temporal execution without a run id', async () => {
    await expect(launchTaskExecution({
      task: buildTask(),
      runId: null,
      workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
      priority: 0,
    }, {
      runtime: TASK_EXECUTION_RUNTIME.TEMPORAL_RUN_TASK,
      launchWorkflow: vi.fn(),
    })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    } satisfies Pick<ApiError, 'code'>)
  })
})
