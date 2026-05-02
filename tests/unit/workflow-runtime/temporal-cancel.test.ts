import { describe, expect, it, vi } from 'vitest'
import {
  cancelTemporalWorkflowRunWithClient,
  type TemporalWorkflowCancelClient,
} from '@/lib/workflow-runtime/temporal/cancel'

function createClient(options: { cancelError?: Error } = {}) {
  const cancel = vi.fn(async () => {
    if (options.cancelError) throw options.cancelError
    return {}
  })
  const getHandle = vi.fn(() => ({ cancel }))
  return {
    client: {
      workflow: { getHandle },
    } as unknown as TemporalWorkflowCancelClient,
    cancel,
    getHandle,
  }
}

describe('Temporal workflow cancellation boundary', () => {
  it('cancels the workflow chain by workflowId and firstExecutionRunId', async () => {
    const { client, cancel, getHandle } = createClient()

    const result = await cancelTemporalWorkflowRunWithClient({
      client,
      workflowId: ' waoowaoo-run-run-1 ',
      firstExecutionRunId: ' temporal-run-1 ',
    })

    expect(getHandle).toHaveBeenCalledWith('waoowaoo-run-run-1', undefined, {
      firstExecutionRunId: 'temporal-run-1',
    })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      workflowId: 'waoowaoo-run-run-1',
      firstExecutionRunId: 'temporal-run-1',
      cancelRequested: true,
    })
  })

  it('exposes missing workflow metadata before calling Temporal', async () => {
    const { client, cancel, getHandle } = createClient()

    await expect(cancelTemporalWorkflowRunWithClient({
      client,
      workflowId: '',
      firstExecutionRunId: 'temporal-run-1',
    })).rejects.toThrow('workflowId is required')
    expect(getHandle).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('requires firstExecutionRunId to avoid ambiguous workflow-chain cancellation', async () => {
    const { client, cancel, getHandle } = createClient()

    await expect(cancelTemporalWorkflowRunWithClient({
      client,
      workflowId: 'waoowaoo-run-run-1',
      firstExecutionRunId: ' ',
    })).rejects.toThrow('firstExecutionRunId is required')
    expect(getHandle).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('exposes Temporal cancellation failures', async () => {
    const { client, cancel } = createClient({
      cancelError: new Error('temporal cancel failed'),
    })

    await expect(cancelTemporalWorkflowRunWithClient({
      client,
      workflowId: 'waoowaoo-run-run-1',
      firstExecutionRunId: 'temporal-run-1',
    })).rejects.toThrow('temporal cancel failed')
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})
