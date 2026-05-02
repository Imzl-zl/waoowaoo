import { describe, expect, it, vi } from 'vitest'
import {
  recordTemporalWorkflowStart,
  withGraphRuntimeClientForTest,
} from '@/lib/run-runtime/service'
import { RUN_STATUS } from '@/lib/run-runtime/types'
import { TEMPORAL_WORKFLOW_TYPE } from '@/lib/workflow-runtime/temporal/types'

function buildRunRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-05-01T09:00:00.000Z')
  return {
    id: 'run-1',
    userId: 'user-1',
    projectId: 'project-1',
    episodeId: 'episode-1',
    workflowType: 'story_to_script_run',
    taskType: 'story_to_script_run',
    taskId: 'task-1',
    targetType: 'NovelPromotionEpisode',
    targetId: 'episode-1',
    status: RUN_STATUS.QUEUED,
    input: { prompt: 'hello' },
    output: null,
    errorCode: null,
    errorMessage: null,
    cancelRequestedAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    workflowVersion: 1,
    temporalWorkflowId: null,
    temporalFirstExecutionRunId: null,
    temporalTaskQueue: null,
    queuedAt: now,
    startedAt: null,
    finishedAt: null,
    lastSeq: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function buildRuntimeClient(row: ReturnType<typeof buildRunRow>) {
  const update = vi.fn(async (args: unknown) => {
    const data = (args as { data: Record<string, unknown> }).data
    return buildRunRow(data)
  })
  return {
    client: {
      graphRun: {
        create: vi.fn(),
        update,
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      graphStep: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      graphStepAttempt: { upsert: vi.fn() },
      graphEvent: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      graphCheckpoint: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      graphArtifact: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    update,
  }
}

describe('run-runtime Temporal metadata', () => {
  it('records Temporal start metadata on the run read model', async () => {
    const { client, update } = buildRuntimeClient(buildRunRow())

    const mapped = await withGraphRuntimeClientForTest(client, async () => (
      await recordTemporalWorkflowStart({
        runId: 'run-1',
        workflowType: 'story_to_script_run',
        temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
        workflowId: 'waoowaoo-run-run-1',
        firstExecutionRunId: 'temporal-run-1',
        taskQueue: 'waoowaoo-main',
      })
    ))

    expect(update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: {
        temporalWorkflowId: 'waoowaoo-run-run-1',
        temporalFirstExecutionRunId: 'temporal-run-1',
        temporalTaskQueue: 'waoowaoo-main',
      },
    })
    expect(mapped).toMatchObject({
      id: 'run-1',
      temporalWorkflowId: 'waoowaoo-run-run-1',
      temporalFirstExecutionRunId: 'temporal-run-1',
      temporalTaskQueue: 'waoowaoo-main',
    })
  })

  it('exposes incomplete Temporal start metadata', async () => {
    const { client, update } = buildRuntimeClient(buildRunRow())

    await expect(withGraphRuntimeClientForTest(client, async () => (
      await recordTemporalWorkflowStart({
        runId: 'run-1',
        workflowType: 'story_to_script_run',
        temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
        workflowId: '',
        firstExecutionRunId: 'temporal-run-1',
        taskQueue: 'waoowaoo-main',
      })
    ))).rejects.toThrow('temporalWorkflowId is required')
    expect(update).not.toHaveBeenCalled()
  })
})
