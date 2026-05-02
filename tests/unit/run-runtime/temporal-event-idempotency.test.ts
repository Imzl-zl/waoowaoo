import { describe, expect, it, vi } from 'vitest'
import {
  appendRunEventWithSeq,
  withGraphRuntimeClientForTest,
} from '@/lib/run-runtime/service'
import { RUN_EVENT_TYPE, RUN_STATUS, type RunEventInput } from '@/lib/run-runtime/types'

const now = new Date('2026-05-02T12:00:00.000Z')

function buildRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    userId: 'user-1',
    projectId: 'project-1',
    episodeId: null,
    workflowType: 'story_to_script_run',
    taskType: 'story_to_script_run',
    taskId: 'task-1',
    targetType: 'NovelPromotionEpisode',
    targetId: 'episode-1',
    status: RUN_STATUS.QUEUED,
    input: {},
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

function buildEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    runId: 'run-1',
    projectId: 'project-1',
    userId: 'user-1',
    seq: 1,
    eventType: RUN_EVENT_TYPE.RUN_START,
    stepKey: null,
    attempt: null,
    lane: null,
    idempotencyKey: null,
    payload: {},
    createdAt: now,
    ...overrides,
  }
}

function createRunEventInput(overrides: Partial<RunEventInput> = {}): RunEventInput {
  return {
    runId: 'run-1',
    projectId: 'project-1',
    userId: 'user-1',
    eventType: RUN_EVENT_TYPE.RUN_START,
    payload: { source: 'temporal' },
    ...overrides,
  }
}

function createRuntimeClient(options: {
  findUnique?: ReturnType<typeof vi.fn>
  createError?: unknown
} = {}) {
  const graphRunUpdate = vi.fn(async (args: unknown) => {
    const select = (args as { select?: { lastSeq?: boolean } }).select
    if (select?.lastSeq) return { id: 'run-1', lastSeq: 1 }
    return buildRunRow({ status: RUN_STATUS.RUNNING, startedAt: now })
  })
  const graphEventCreate = vi.fn(async (args: unknown) => {
    if (options.createError) throw options.createError
    const data = (args as { data: Record<string, unknown> }).data
    return buildEventRow(data)
  })
  const graphEventFindUnique = options.findUnique || vi.fn(async () => null)
  const tx = {
    graphRun: {
      create: vi.fn(),
      update: graphRunUpdate,
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
      create: graphEventCreate,
      findUnique: graphEventFindUnique,
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
  }
  const transaction = vi.fn(async (action: (client: typeof tx) => Promise<unknown>) => action(tx))
  const client = { ...tx, $transaction: transaction } as unknown as Parameters<
    typeof withGraphRuntimeClientForTest
  >[0]
  return {
    client,
    graphEventCreate,
    graphEventFindUnique,
    graphRunUpdate,
    transaction,
  }
}

describe('appendRunEventWithSeq idempotency', () => {
  it('creates events with a normalized idempotency key', async () => {
    const runtime = createRuntimeClient()

    const event = await withGraphRuntimeClientForTest(runtime.client, async () => (
      await appendRunEventWithSeq(createRunEventInput({
        idempotencyKey: ' temporal:run-1:run.start ',
      }))
    ))

    expect(runtime.graphEventFindUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'temporal:run-1:run.start' },
    })
    expect(runtime.graphEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: 'temporal:run-1:run.start',
        seq: 1,
      }),
    })
    expect(event).toMatchObject({
      idempotencyKey: 'temporal:run-1:run.start',
      seq: 1,
    })
  })

  it('returns the existing event when the idempotency key was already written', async () => {
    const existing = buildEventRow({
      id: BigInt(9),
      seq: 4,
      idempotencyKey: 'temporal:run-1:run.start',
    })
    const runtime = createRuntimeClient({
      findUnique: vi.fn(async () => existing),
    })

    const event = await withGraphRuntimeClientForTest(runtime.client, async () => (
      await appendRunEventWithSeq(createRunEventInput({
        idempotencyKey: 'temporal:run-1:run.start',
      }))
    ))

    expect(runtime.transaction).not.toHaveBeenCalled()
    expect(runtime.graphEventCreate).not.toHaveBeenCalled()
    expect(event).toMatchObject({
      id: '9',
      seq: 4,
      idempotencyKey: 'temporal:run-1:run.start',
    })
  })

  it('resolves a concurrent unique-key conflict by returning the existing event', async () => {
    const existing = buildEventRow({
      id: BigInt(10),
      seq: 5,
      idempotencyKey: 'temporal:run-1:run.start',
    })
    const uniqueError = Object.assign(new Error('duplicate event'), { code: 'P2002' })
    const graphEventFindUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing)
    const runtime = createRuntimeClient({
      findUnique: graphEventFindUnique,
      createError: uniqueError,
    })

    const event = await withGraphRuntimeClientForTest(runtime.client, async () => (
      await appendRunEventWithSeq(createRunEventInput({
        idempotencyKey: 'temporal:run-1:run.start',
      }))
    ))

    expect(runtime.transaction).toHaveBeenCalledTimes(1)
    expect(event).toMatchObject({
      id: '10',
      seq: 5,
      idempotencyKey: 'temporal:run-1:run.start',
    })
  })

  it('exposes idempotency keys that cannot fit the database column', async () => {
    const runtime = createRuntimeClient()

    await expect(withGraphRuntimeClientForTest(runtime.client, async () => (
      await appendRunEventWithSeq(createRunEventInput({
        idempotencyKey: 'x'.repeat(192),
      }))
    ))).rejects.toThrow('run event idempotencyKey exceeds 191 characters')
    expect(runtime.transaction).not.toHaveBeenCalled()
  })
})
