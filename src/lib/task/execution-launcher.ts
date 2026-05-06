import { ApiError } from '@/lib/api-errors'
import { launchTemporalWorkflowRun } from '@/lib/workflow-runtime/temporal/launch'
import { TEMPORAL_WORKFLOW_TYPE } from '@/lib/workflow-runtime/temporal/types'
import type { TemporalWorkflowLaunchResult } from '@/lib/workflow-runtime/temporal/launch'
import type { TemporalWorkflowRunInput } from '@/lib/workflow-runtime/temporal/types'
import { TASK_TYPE, type TaskJobData, type TaskType } from './types'

export const TASK_EXECUTION_RUNTIME = {
  BULLMQ: 'bullmq',
  TEMPORAL_RUN_TASK: 'temporal_run_task',
} as const

export type TaskExecutionRuntime =
  (typeof TASK_EXECUTION_RUNTIME)[keyof typeof TASK_EXECUTION_RUNTIME]

export type TaskExecutionLaunchInput = Readonly<{
  task: TaskJobData
  runId?: string | null
  workflowType: string
  priority: number
}>

export type TaskExecutionLaunchResult = Readonly<{
  runtime: TaskExecutionRuntime
  externalId?: string | null
}>

type BullMqTaskLauncher = (
  data: TaskJobData,
  opts?: { priority?: number },
) => Promise<{ id?: string | number | null }>
type TemporalRunTaskLauncher = typeof launchTemporalWorkflowRun

export type LaunchTaskExecutionDeps = Readonly<{
  runtime?: TaskExecutionRuntime
  addJob?: BullMqTaskLauncher
  launchWorkflow?: TemporalRunTaskLauncher
}>

const TEMPORAL_RUN_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  TASK_TYPE.STORY_TO_SCRIPT_RUN,
  TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
])

function readRuntimeFromEnv(): TaskExecutionRuntime {
  const value = process.env.TASK_EXECUTION_RUNTIME?.trim()
  if (!value) return TASK_EXECUTION_RUNTIME.BULLMQ
  if (value === TASK_EXECUTION_RUNTIME.BULLMQ) return TASK_EXECUTION_RUNTIME.BULLMQ
  if (value === TASK_EXECUTION_RUNTIME.TEMPORAL_RUN_TASK) {
    return TASK_EXECUTION_RUNTIME.TEMPORAL_RUN_TASK
  }
  throw new Error(`unsupported TASK_EXECUTION_RUNTIME: ${value}`)
}

function requireRunId(runId: string | null | undefined): string {
  const trimmed = runId?.trim() || ''
  if (!trimmed) {
    throw new ApiError('INVALID_PARAMS', {
      message: 'runId is required for Temporal task execution',
    })
  }
  return trimmed
}

function assertTemporalRunTaskType(type: TaskType) {
  if (TEMPORAL_RUN_TASK_TYPES.has(type)) return
  throw new ApiError('INVALID_PARAMS', {
    message: `task type ${type} is not supported by Temporal run-task execution`,
  })
}

export function buildTemporalRunTaskInput(
  input: TaskExecutionLaunchInput,
): TemporalWorkflowRunInput {
  const runId = requireRunId(input.runId)
  return {
    runId,
    workflowType: input.workflowType,
    projectId: input.task.projectId,
    userId: input.task.userId,
    episodeId: input.task.episodeId || null,
    taskId: input.task.taskId,
    targetType: input.task.targetType,
    targetId: input.task.targetId,
    payload: input.task.payload || null,
  }
}

async function launchBullMqTask(
  input: TaskExecutionLaunchInput,
  addJob?: BullMqTaskLauncher,
): Promise<TaskExecutionLaunchResult> {
  const launcher = addJob || (await import('./queues')).addTaskJob
  const job = await launcher(input.task, { priority: input.priority })
  return {
    runtime: TASK_EXECUTION_RUNTIME.BULLMQ,
    externalId: typeof job.id === 'string' ? job.id : null,
  }
}

async function launchTemporalRunTask(
  input: TaskExecutionLaunchInput,
  launchWorkflow: TemporalRunTaskLauncher,
): Promise<TaskExecutionLaunchResult> {
  assertTemporalRunTaskType(input.task.type)
  const launched: TemporalWorkflowLaunchResult = await launchWorkflow({
    temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.RUN_TASK,
    input: buildTemporalRunTaskInput(input),
  })
  return {
    runtime: TASK_EXECUTION_RUNTIME.TEMPORAL_RUN_TASK,
    externalId: launched.start.workflowId,
  }
}

export async function launchTaskExecution(
  input: TaskExecutionLaunchInput,
  deps: LaunchTaskExecutionDeps = {},
): Promise<TaskExecutionLaunchResult> {
  const runtime = deps.runtime || readRuntimeFromEnv()
  if (runtime === TASK_EXECUTION_RUNTIME.BULLMQ) {
    return await launchBullMqTask(input, deps.addJob)
  }
  return await launchTemporalRunTask(input, deps.launchWorkflow || launchTemporalWorkflowRun)
}
