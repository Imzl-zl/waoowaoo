import { proxyActivities } from '@temporalio/workflow'
import type { TemporalActivities } from './activities'
import type { TemporalWorkflowRunInput, TemporalWorkflowRunResult } from './types'
import { buildTemporalWorkflowRunResult } from './contract'

const activities = proxyActivities<TemporalActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
  },
})

export async function smokeWorkflow(input: TemporalWorkflowRunInput): Promise<TemporalWorkflowRunResult> {
  const started = await activities.recordWorkflowStarted(input)
  await activities.recordWorkflowStepStarted(input)
  const result = buildTemporalWorkflowRunResult(started)
  await activities.recordWorkflowStepCompleted(input, result)
  await activities.recordWorkflowCompleted(input, result)
  return result
}
