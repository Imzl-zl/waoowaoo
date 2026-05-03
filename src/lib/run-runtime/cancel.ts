import { cancelTask } from '@/lib/task/service'
import { cancelTemporalWorkflowRun } from '@/lib/workflow-runtime/temporal/cancel'
import { publishRunEvent } from './publisher'
import { getRunById, requestRunCancel } from './service'
import { RUN_EVENT_TYPE, RUN_STATUS } from './types'

const RUN_CANCEL_MESSAGE = 'Run cancelled by user'
const RUN_CANCEL_EVENT_IDEMPOTENCY_PREFIX = 'run-cancel'

type RunRecord = NonNullable<Awaited<ReturnType<typeof getRunById>>>
type CancelLinkedTask = (taskId: string, reason: string) => Promise<unknown>
type CancelTemporalWorkflow = typeof cancelTemporalWorkflowRun
type PublishCanceledEvent = (input: Parameters<typeof publishRunEvent>[0]) => Promise<unknown>
type RequestRunCancel = typeof requestRunCancel
type GetRunById = typeof getRunById

type TemporalCancelTarget = Readonly<{
  workflowId: string
  firstExecutionRunId: string
}>

export type RequestManagedRunCancelParams = Readonly<{
  runId: string
  userId: string
  getRun?: GetRunById
  requestCancel?: RequestRunCancel
  cancelLinkedTask?: CancelLinkedTask
  cancelTemporalWorkflow?: CancelTemporalWorkflow
  publishCanceledEvent?: PublishCanceledEvent
}>

export type ManagedRunCancelResult = Readonly<{
  run: RunRecord
  taskCancellation: unknown
  temporalCancellation: Awaited<ReturnType<CancelTemporalWorkflow>> | null
  event: unknown
}>

function isCancellationActive(run: RunRecord): boolean {
  return run.status === RUN_STATUS.CANCELING || run.status === RUN_STATUS.CANCELED
}

function resolveTemporalCancelTarget(run: RunRecord): TemporalCancelTarget | null {
  const workflowId = run.temporalWorkflowId?.trim() || ''
  const firstExecutionRunId = run.temporalFirstExecutionRunId?.trim() || ''
  if (!workflowId && !firstExecutionRunId) return null
  if (!workflowId) throw new Error('temporalWorkflowId is required for run cancellation')
  if (!firstExecutionRunId) {
    throw new Error('temporalFirstExecutionRunId is required for run cancellation')
  }
  return { workflowId, firstExecutionRunId }
}

async function cancelTemporalRun(
  run: RunRecord,
  cancelWorkflow: CancelTemporalWorkflow,
) {
  const target = resolveTemporalCancelTarget(run)
  if (!target) return null
  return await cancelWorkflow(target)
}

async function cancelLinkedTask(run: RunRecord, cancelTaskFn: CancelLinkedTask) {
  if (!run.taskId) return null
  return await cancelTaskFn(run.taskId, RUN_CANCEL_MESSAGE)
}

async function publishRunCanceled(run: RunRecord, publishEvent: PublishCanceledEvent) {
  return await publishEvent({
    runId: run.id,
    projectId: run.projectId,
    userId: run.userId,
    eventType: RUN_EVENT_TYPE.RUN_CANCELED,
    idempotencyKey: `${RUN_CANCEL_EVENT_IDEMPOTENCY_PREFIX}:${run.id}`,
    payload: {
      message: RUN_CANCEL_MESSAGE,
    },
  })
}

export async function requestManagedRunCancel(
  params: RequestManagedRunCancelParams,
): Promise<ManagedRunCancelResult | null> {
  const {
    getRun = getRunById,
    requestCancel = requestRunCancel,
    cancelLinkedTask: cancelLinkedTaskFn = cancelTask,
    cancelTemporalWorkflow = cancelTemporalWorkflowRun,
    publishCanceledEvent = publishRunEvent,
  } = params
  const existingRun = await getRun(params.runId)
  if (!existingRun || existingRun.userId !== params.userId) return null

  const run = await requestCancel({ runId: params.runId, userId: params.userId })
  if (!run) return null
  if (!isCancellationActive(run)) {
    return { run, taskCancellation: null, temporalCancellation: null, event: null }
  }

  const temporalCancellation = await cancelTemporalRun(run, cancelTemporalWorkflow)
  const taskCancellation = await cancelLinkedTask(run, cancelLinkedTaskFn)
  const event = await publishRunCanceled(run, publishCanceledEvent)
  return { run, taskCancellation, temporalCancellation, event }
}
