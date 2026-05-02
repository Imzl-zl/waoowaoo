import type { Client, WorkflowHandleWithStartDetails } from '@temporalio/client'
import { createTemporalClient } from './client'
import { normalizeTemporalWorkflowRunInput } from './contract'
import { resolveTemporalRuntimeConfig } from './config'
import {
  TEMPORAL_WORKFLOW_ID_PREFIX,
  type TemporalRuntimeConfig,
  type TemporalWorkflowRunInput,
  type TemporalWorkflowStartResult,
  type TemporalWorkflowType,
} from './types'

export type TemporalWorkflowStartClient = Pick<Client, 'workflow'>

export type StartTemporalWorkflowRunParams = Readonly<{
  client: TemporalWorkflowStartClient
  config?: TemporalRuntimeConfig
  temporalWorkflowType: TemporalWorkflowType
  input: TemporalWorkflowRunInput
}>

export type StartManagedTemporalWorkflowRunParams = Omit<StartTemporalWorkflowRunParams, 'client' | 'config'>

export function buildTemporalWorkflowId(runId: string): string {
  const trimmed = runId.trim()
  if (!trimmed) {
    throw new Error('runId is required')
  }
  return `${TEMPORAL_WORKFLOW_ID_PREFIX}${trimmed}`
}

function toStartResult(params: {
  input: TemporalWorkflowRunInput
  temporalWorkflowType: TemporalWorkflowType
  taskQueue: string
  handle: WorkflowHandleWithStartDetails
}): TemporalWorkflowStartResult {
  return {
    runId: params.input.runId,
    workflowType: params.input.workflowType,
    temporalWorkflowType: params.temporalWorkflowType,
    workflowId: params.handle.workflowId,
    firstExecutionRunId: params.handle.firstExecutionRunId,
    taskQueue: params.taskQueue,
  }
}

export async function startTemporalWorkflowRunWithClient(
  params: StartTemporalWorkflowRunParams,
): Promise<TemporalWorkflowStartResult> {
  const input = normalizeTemporalWorkflowRunInput(params.input)
  const config = params.config || resolveTemporalRuntimeConfig()
  const handle = await params.client.workflow.start(params.temporalWorkflowType, {
    args: [input],
    workflowId: buildTemporalWorkflowId(input.runId),
    taskQueue: config.taskQueue,
  })

  return toStartResult({
    input,
    temporalWorkflowType: params.temporalWorkflowType,
    taskQueue: config.taskQueue,
    handle,
  })
}

export async function startTemporalWorkflowRun(
  params: StartManagedTemporalWorkflowRunParams,
): Promise<TemporalWorkflowStartResult> {
  const { client, connection, config } = await createTemporalClient()
  try {
    return await startTemporalWorkflowRunWithClient({
      ...params,
      client,
      config,
    })
  } finally {
    await connection.close()
  }
}
