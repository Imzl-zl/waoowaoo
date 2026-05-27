import type { TaskType } from '@/lib/task/types'
import type { TemporalWorkflowStepDescriptor } from './types'

export const TEMPORAL_RUN_TASK_TYPES = [
  'story_to_script_run',
  'script_to_storyboard_run',
] as const satisfies readonly TaskType[]

const TEMPORAL_RUN_TASK_TYPE_SET: ReadonlySet<string> = new Set(TEMPORAL_RUN_TASK_TYPES)

export const TEMPORAL_RUN_TASK_FAILURE_STEP: TemporalWorkflowStepDescriptor = {
  stepKey: 'run_task.execute',
  stepTitle: 'Run task execution',
  stepIndex: 1,
  stepTotal: 1,
  attempt: 1,
}

export function isTemporalRunTaskType(value: string): value is TaskType {
  return TEMPORAL_RUN_TASK_TYPE_SET.has(value)
}
