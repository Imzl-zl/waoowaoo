import type { Client } from '@temporalio/client'
import { createTemporalClient } from './client'

export type TemporalWorkflowCancelClient = Pick<Client, 'workflow'>

export type CancelTemporalWorkflowRunParams = Readonly<{
  client: TemporalWorkflowCancelClient
  workflowId: string
  firstExecutionRunId: string
}>

export type CancelManagedTemporalWorkflowRunParams = Omit<
  CancelTemporalWorkflowRunParams,
  'client'
>

export type TemporalWorkflowCancelResult = Readonly<{
  workflowId: string
  firstExecutionRunId: string
  cancelRequested: true
}>

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${label} is required`)
  }
  return trimmed
}

export async function cancelTemporalWorkflowRunWithClient(
  params: CancelTemporalWorkflowRunParams,
): Promise<TemporalWorkflowCancelResult> {
  const workflowId = requireTrimmed(params.workflowId, 'workflowId')
  const firstExecutionRunId = requireTrimmed(
    params.firstExecutionRunId,
    'firstExecutionRunId',
  )
  const handle = params.client.workflow.getHandle(workflowId, undefined, {
    firstExecutionRunId,
  })
  await handle.cancel()
  return {
    workflowId,
    firstExecutionRunId,
    cancelRequested: true,
  }
}

export async function cancelTemporalWorkflowRun(
  params: CancelManagedTemporalWorkflowRunParams,
): Promise<TemporalWorkflowCancelResult> {
  const { client, connection } = await createTemporalClient()
  try {
    return await cancelTemporalWorkflowRunWithClient({
      ...params,
      client,
    })
  } finally {
    await connection.close()
  }
}
