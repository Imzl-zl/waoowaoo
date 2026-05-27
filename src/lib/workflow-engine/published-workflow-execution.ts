import { ApiError } from '@/lib/api-errors'
import { appendRunEventWithSeq, createRun } from '@/lib/run-runtime/service'
import { RUN_EVENT_TYPE, type RunEventInput } from '@/lib/run-runtime/types'
import { launchTemporalWorkflowRun } from '@/lib/workflow-runtime/temporal/launch'
import { TEMPORAL_WORKFLOW_TYPE } from '@/lib/workflow-runtime/temporal/types'
import type { TemporalWorkflowLaunchResult } from '@/lib/workflow-runtime/temporal/launch'
import type { WorkflowTypeParams } from './definition-store-types'
import {
  assertPublishedWorkflowExecutionPlanExecutable,
  getProjectPublishedWorkflowExecutionPlan,
} from './published-definition-execution-plan'
import type { PublishedWorkflowExecutionPlan } from './execution-plan-types'

const PUBLISHED_WORKFLOW_TARGET_TYPE = 'WorkflowDefinitionVersion'

type CreatedRun = Awaited<ReturnType<typeof createRun>>
type CreatePublishedWorkflowRun = typeof createRun
type LaunchPublishedWorkflow = typeof launchTemporalWorkflowRun
type WriteRunEvent = (input: RunEventInput) => Promise<unknown>
type GetExecutionPlan = (
  params: WorkflowTypeParams,
) => Promise<PublishedWorkflowExecutionPlan | null>

export type PublishedWorkflowExecutionInput = Readonly<Record<string, unknown>>

export type ExecuteProjectPublishedWorkflowDefinitionParams = WorkflowTypeParams & Readonly<{
  executionInput?: unknown
}>

export type ExecuteProjectPublishedWorkflowDefinitionDeps = Readonly<{
  getExecutionPlan?: GetExecutionPlan
  createWorkflowRun?: CreatePublishedWorkflowRun
  launchWorkflow?: LaunchPublishedWorkflow
  writeRunEvent?: WriteRunEvent
}>

export type ExecuteProjectPublishedWorkflowDefinitionResult = Readonly<{
  runId: string
  run: CreatedRun
  plan: PublishedWorkflowExecutionPlan
  launch: TemporalWorkflowLaunchResult
}>

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function normalizeExecutionInput(value: unknown): PublishedWorkflowExecutionInput {
  if (value === undefined || value === null) return {}
  const record = readRecord(value)
  if (!record) throw new ApiError('INVALID_PARAMS', {
    code: 'WORKFLOW_EXECUTION_INPUT_INVALID',
    message: 'workflow execution input must be an object',
  })
  const wrappedInput = 'executionInput' in record
    ? record.executionInput
    : 'inputs' in record
      ? record.inputs
      : record
  const inputRecord = readRecord(wrappedInput)
  if (!inputRecord) throw new ApiError('INVALID_PARAMS', {
    code: 'WORKFLOW_EXECUTION_INPUT_INVALID',
    message: 'workflow execution input must be an object',
  })
  return { ...inputRecord }
}

function workflowTypeParams(
  params: ExecuteProjectPublishedWorkflowDefinitionParams,
): WorkflowTypeParams {
  return {
    db: params.db,
    projectId: params.projectId,
    userId: params.userId,
    workflowType: params.workflowType,
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return 'Published workflow launch failed'
}

function buildLaunchFailureEvent(input: {
  run: CreatedRun
  plan: PublishedWorkflowExecutionPlan
  error: unknown
}): RunEventInput {
  return {
    runId: input.run.id,
    projectId: input.run.projectId,
    userId: input.run.userId,
    eventType: RUN_EVENT_TYPE.RUN_ERROR,
    idempotencyKey: `published-workflow-launch-failed:${input.run.id}`,
    payload: {
      errorCode: 'PUBLISHED_WORKFLOW_LAUNCH_FAILED',
      message: errorMessage(input.error),
      workflowDefinitionId: input.plan.workflowDefinitionId,
      workflowDefinitionVersionId: input.plan.workflowDefinitionVersionId,
      workflowType: input.plan.workflowType,
    },
  }
}

async function createPublishedWorkflowRun(input: {
  params: ExecuteProjectPublishedWorkflowDefinitionParams
  plan: PublishedWorkflowExecutionPlan
  executionInput: PublishedWorkflowExecutionInput
  createWorkflowRun: CreatePublishedWorkflowRun
}): Promise<CreatedRun> {
  return await input.createWorkflowRun({
    userId: input.params.userId,
    projectId: input.params.projectId,
    workflowType: input.plan.workflowType,
    targetType: PUBLISHED_WORKFLOW_TARGET_TYPE,
    targetId: input.plan.workflowDefinitionVersionId,
    input: {
      workflowDefinitionId: input.plan.workflowDefinitionId,
      workflowDefinitionVersionId: input.plan.workflowDefinitionVersionId,
      workflowVersion: input.plan.version,
      workflowTitle: input.plan.title,
      executionInput: input.executionInput,
      temporalSteps: input.plan.temporalSteps,
      publishedWorkflowSteps: input.plan.publishedWorkflowSteps,
    },
  })
}

async function launchPublishedWorkflow(input: {
  params: ExecuteProjectPublishedWorkflowDefinitionParams
  run: CreatedRun
  plan: PublishedWorkflowExecutionPlan
  executionInput: PublishedWorkflowExecutionInput
  launchWorkflow: LaunchPublishedWorkflow
}) {
  return await input.launchWorkflow({
    temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.PUBLISHED_WORKFLOW,
    input: {
      runId: input.run.id,
      workflowType: input.plan.workflowType,
      projectId: input.params.projectId,
      userId: input.params.userId,
      targetType: PUBLISHED_WORKFLOW_TARGET_TYPE,
      targetId: input.plan.workflowDefinitionVersionId,
      payload: {
        workflowDefinitionId: input.plan.workflowDefinitionId,
        workflowDefinitionVersionId: input.plan.workflowDefinitionVersionId,
        workflowVersion: input.plan.version,
        workflowTitle: input.plan.title,
        executionInput: input.executionInput,
        temporalSteps: input.plan.temporalSteps,
        publishedWorkflowSteps: input.plan.publishedWorkflowSteps,
      },
    },
  })
}

export async function executeProjectPublishedWorkflowDefinition(
  params: ExecuteProjectPublishedWorkflowDefinitionParams,
  deps: ExecuteProjectPublishedWorkflowDefinitionDeps = {},
): Promise<ExecuteProjectPublishedWorkflowDefinitionResult> {
  const getExecutionPlan = deps.getExecutionPlan || getProjectPublishedWorkflowExecutionPlan
  const plan = await getExecutionPlan(workflowTypeParams(params))
  if (!plan) throw new ApiError('NOT_FOUND')
  assertPublishedWorkflowExecutionPlanExecutable(plan)

  const createWorkflowRun = deps.createWorkflowRun || createRun
  const launchWorkflow = deps.launchWorkflow || launchTemporalWorkflowRun
  const writeRunEvent = deps.writeRunEvent || appendRunEventWithSeq
  const executionInput = normalizeExecutionInput(params.executionInput)
  const run = await createPublishedWorkflowRun({
    params,
    plan,
    executionInput,
    createWorkflowRun,
  })

  try {
    const launch = await launchPublishedWorkflow({
      params,
      run,
      plan,
      executionInput,
      launchWorkflow,
    })
    return {
      runId: run.id,
      run,
      plan,
      launch,
    }
  } catch (error) {
    await writeRunEvent(buildLaunchFailureEvent({ run, plan, error }))
    throw error
  }
}
