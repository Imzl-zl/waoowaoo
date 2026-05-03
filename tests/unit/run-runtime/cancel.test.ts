import { describe, expect, it, vi } from 'vitest'
import { requestManagedRunCancel } from '@/lib/run-runtime/cancel'
import { RUN_STATUS } from '@/lib/run-runtime/types'
import type { getRunById } from '@/lib/run-runtime/service'

type RunRecord = NonNullable<Awaited<ReturnType<typeof getRunById>>>

function buildRun(overrides: Partial<RunRecord> = {}): RunRecord {
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
    status: RUN_STATUS.CANCELING,
    input: {},
    output: {},
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
    queuedAt: '2026-05-02T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    lastSeq: 0,
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
    ...overrides,
  }
}

function createDeps(options: {
  existingRun?: RunRecord | null
  requestedRun?: RunRecord | null
} = {}) {
  return {
    getRun: vi.fn(async () => options.existingRun ?? buildRun()),
    requestCancel: vi.fn(async () => options.requestedRun ?? buildRun()),
    cancelLinkedTask: vi.fn(async () => ({ cancelled: true, task: { id: 'task-1' } })),
    cancelTemporalWorkflow: vi.fn(async () => ({
      workflowId: 'workflow-1',
      firstExecutionRunId: 'temporal-run-1',
      cancelRequested: true as const,
    })),
    publishCanceledEvent: vi.fn(async () => ({ id: 'event-1' })),
  }
}

describe('requestManagedRunCancel', () => {
  it('cancels Temporal execution, linked task, and publishes an idempotent run event', async () => {
    const temporalRun = buildRun({
      temporalWorkflowId: ' workflow-1 ',
      temporalFirstExecutionRunId: ' temporal-run-1 ',
    })
    const deps = createDeps({ existingRun: temporalRun, requestedRun: temporalRun })

    const result = await requestManagedRunCancel({
      runId: 'run-1',
      userId: 'user-1',
      ...deps,
    })

    expect(result?.temporalCancellation).toMatchObject({ cancelRequested: true })
    expect(deps.cancelTemporalWorkflow).toHaveBeenCalledWith({
      workflowId: 'workflow-1',
      firstExecutionRunId: 'temporal-run-1',
    })
    expect(deps.cancelLinkedTask).toHaveBeenCalledWith('task-1', 'Run cancelled by user')
    expect(deps.publishCanceledEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'run.canceled',
      idempotencyKey: 'run-cancel:run-1',
    }))
  })

  it('leaves terminal runs without external cancellation side effects', async () => {
    const completedRun = buildRun({ status: RUN_STATUS.COMPLETED })
    const deps = createDeps({ requestedRun: completedRun })

    const result = await requestManagedRunCancel({
      runId: 'run-1',
      userId: 'user-1',
      ...deps,
    })

    expect(result?.run.status).toBe(RUN_STATUS.COMPLETED)
    expect(deps.cancelTemporalWorkflow).not.toHaveBeenCalled()
    expect(deps.cancelLinkedTask).not.toHaveBeenCalled()
    expect(deps.publishCanceledEvent).not.toHaveBeenCalled()
  })

  it('exposes incomplete Temporal cancellation metadata', async () => {
    const run = buildRun({ temporalWorkflowId: 'workflow-1' })
    const deps = createDeps({ requestedRun: run })

    await expect(requestManagedRunCancel({
      runId: 'run-1',
      userId: 'user-1',
      ...deps,
    })).rejects.toThrow('temporalFirstExecutionRunId is required for run cancellation')
    expect(deps.cancelLinkedTask).not.toHaveBeenCalled()
    expect(deps.publishCanceledEvent).not.toHaveBeenCalled()
  })

  it('returns null when the run does not belong to the user', async () => {
    const deps = createDeps({ existingRun: buildRun({ userId: 'user-2' }) })

    const result = await requestManagedRunCancel({
      runId: 'run-1',
      userId: 'user-1',
      ...deps,
    })

    expect(result).toBeNull()
    expect(deps.requestCancel).not.toHaveBeenCalled()
  })
})
