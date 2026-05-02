import { describe, expect, it } from 'vitest'
import { resolveTemporalRuntimeConfig } from '@/lib/workflow-runtime/temporal/config'

describe('resolveTemporalRuntimeConfig', () => {
  it('uses explicit Temporal environment values', () => {
    expect(resolveTemporalRuntimeConfig({
      TEMPORAL_ADDRESS: 'temporal:7233',
      TEMPORAL_NAMESPACE: 'waoowaoo-prod',
      TEMPORAL_TASK_QUEUE: 'waoowaoo-main',
    })).toEqual({
      address: 'temporal:7233',
      namespace: 'waoowaoo-prod',
      taskQueue: 'waoowaoo-main',
    })
  })

  it('uses local defaults when values are omitted', () => {
    expect(resolveTemporalRuntimeConfig({})).toEqual({
      address: 'localhost:7233',
      namespace: 'default',
      taskQueue: 'waoowaoo-workflows',
    })
  })

  it('rejects addresses with protocols', () => {
    expect(() => resolveTemporalRuntimeConfig({
      TEMPORAL_ADDRESS: 'http://localhost:7233',
    })).toThrow('TEMPORAL_ADDRESS must be host:port without protocol')
  })

  it('rejects namespace values with unsupported characters', () => {
    expect(() => resolveTemporalRuntimeConfig({
      TEMPORAL_NAMESPACE: 'bad namespace',
    })).toThrow('TEMPORAL_NAMESPACE contains unsupported characters')
  })
})

