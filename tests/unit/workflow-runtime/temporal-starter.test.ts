import { describe, expect, it, vi } from 'vitest'
import {
  buildTemporalWorkflowId,
  startTemporalWorkflowRunWithClient,
  type TemporalWorkflowStartClient,
} from '@/lib/workflow-runtime/temporal/starter'
import { TEMPORAL_WORKFLOW_TYPE } from '@/lib/workflow-runtime/temporal/types'

const input = {
  runId: 'run-1',
  workflowType: 'story_to_script_run',
  projectId: 'project-1',
  userId: 'user-1',
  episodeId: 'episode-1',
  taskId: 'task-1',
  targetType: 'NovelPromotionEpisode',
  targetId: 'episode-1',
  payload: { source: 'unit-test' },
}

function createClient() {
  const start = vi.fn(async () => ({
    workflowId: 'waoowaoo-run-run-1',
    firstExecutionRunId: 'temporal-run-1',
  }))
  return {
    client: {
      workflow: { start },
    } as unknown as TemporalWorkflowStartClient,
    start,
  }
}

describe('Temporal workflow starter', () => {
  it('builds stable workflow ids from run ids', () => {
    expect(buildTemporalWorkflowId(' run-1 ')).toBe('waoowaoo-run-run-1')
  })

  it('rejects empty workflow id inputs', () => {
    expect(() => buildTemporalWorkflowId(' ')).toThrow('runId is required')
  })

  it('starts the requested Temporal workflow with normalized run input', async () => {
    const { client, start } = createClient()

    const result = await startTemporalWorkflowRunWithClient({
      client,
      config: {
        address: 'temporal:7233',
        namespace: 'default',
        taskQueue: 'waoowaoo-main',
      },
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
      input: {
        ...input,
        runId: ' run-1 ',
      },
    })

    expect(start).toHaveBeenCalledWith(TEMPORAL_WORKFLOW_TYPE.SMOKE, {
      args: [{ ...input, runId: 'run-1' }],
      workflowId: 'waoowaoo-run-run-1',
      taskQueue: 'waoowaoo-main',
    })
    expect(result).toEqual({
      runId: 'run-1',
      workflowType: 'story_to_script_run',
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
      workflowId: 'waoowaoo-run-run-1',
      firstExecutionRunId: 'temporal-run-1',
      taskQueue: 'waoowaoo-main',
    })
  })

  it('starts the run task workflow type', async () => {
    const { client, start } = createClient()

    await startTemporalWorkflowRunWithClient({
      client,
      config: {
        address: 'temporal:7233',
        namespace: 'default',
        taskQueue: 'waoowaoo-main',
      },
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.RUN_TASK,
      input,
    })

    expect(start).toHaveBeenCalledWith(TEMPORAL_WORKFLOW_TYPE.RUN_TASK, expect.objectContaining({
      workflowId: 'waoowaoo-run-run-1',
      taskQueue: 'waoowaoo-main',
    }))
  })

  it('exposes invalid workflow start inputs', async () => {
    const { client } = createClient()

    await expect(startTemporalWorkflowRunWithClient({
      client,
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
      input: {
        ...input,
        targetId: '',
      },
    })).rejects.toThrow('targetId is required')
  })

  it('rejects non-object workflow payloads', async () => {
    const { client } = createClient()

    await expect(startTemporalWorkflowRunWithClient({
      client,
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.SMOKE,
      input: {
        ...input,
        payload: [] as unknown as Record<string, unknown>,
      },
    })).rejects.toThrow('payload must be an object when provided')
  })
})
