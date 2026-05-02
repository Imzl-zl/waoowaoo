import { describe, expect, it, vi } from 'vitest'
import { launchTemporalWorkflowRun } from '@/lib/workflow-runtime/temporal/launch'
import { TEMPORAL_WORKFLOW_TYPE, type TemporalWorkflowStartResult } from '@/lib/workflow-runtime/temporal/types'

const input = {
  runId: 'run-1',
  workflowType: 'story_to_script_run',
  projectId: 'project-1',
  userId: 'user-1',
  taskId: 'task-1',
  targetType: 'NovelPromotionEpisode',
  targetId: 'episode-1',
  payload: { source: 'unit-test' },
}

const startResult: TemporalWorkflowStartResult = {
  runId: 'run-1',
  workflowType: 'story_to_script_run',
  temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
  workflowId: 'waoowaoo-run-run-1',
  firstExecutionRunId: 'temporal-run-1',
  taskQueue: 'waoowaoo-main',
}

describe('launchTemporalWorkflowRun', () => {
  it('starts the Temporal workflow then records metadata', async () => {
    const order: string[] = []
    const startWorkflow = vi.fn(async () => {
      order.push('start')
      return startResult
    })
    const recordWorkflowStart = vi.fn(async () => {
      order.push('record')
      return { temporalWorkflowId: startResult.workflowId }
    })

    const result = await launchTemporalWorkflowRun({
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
      input,
      startWorkflow,
      recordWorkflowStart,
    })

    expect(startWorkflow).toHaveBeenCalledWith({
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
      input,
    })
    expect(recordWorkflowStart).toHaveBeenCalledWith(startResult)
    expect(order).toEqual(['start', 'record'])
    expect(result).toEqual({
      start: startResult,
      recorded: { temporalWorkflowId: startResult.workflowId },
    })
  })

  it('exposes metadata recording failures after a successful start', async () => {
    const startWorkflow = vi.fn(async () => startResult)
    const recordWorkflowStart = vi.fn(async () => {
      throw new Error('metadata write failed')
    })

    await expect(launchTemporalWorkflowRun({
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
      input,
      startWorkflow,
      recordWorkflowStart,
    })).rejects.toThrow('metadata write failed')
    expect(startWorkflow).toHaveBeenCalledTimes(1)
    expect(recordWorkflowStart).toHaveBeenCalledWith(startResult)
  })

  it('does not record metadata when workflow start fails', async () => {
    const startWorkflow = vi.fn(async () => {
      throw new Error('temporal start failed')
    })
    const recordWorkflowStart = vi.fn()

    await expect(launchTemporalWorkflowRun({
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
      input,
      startWorkflow,
      recordWorkflowStart,
    })).rejects.toThrow('temporal start failed')
    expect(recordWorkflowStart).not.toHaveBeenCalled()
  })
})
