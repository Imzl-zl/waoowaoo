import {
  TEMPORAL_DEFAULT_ADDRESS,
  TEMPORAL_DEFAULT_NAMESPACE,
  TEMPORAL_DEFAULT_TASK_QUEUE,
  type TemporalRuntimeConfig,
} from './types'

type TemporalEnv = Readonly<Record<string, string | undefined>>

function readTrimmedEnv(env: TemporalEnv, name: string): string | null {
  const value = env[name]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeTemporalAddress(value: string | null): string {
  const address = value || TEMPORAL_DEFAULT_ADDRESS
  if (address.includes('://')) {
    throw new Error('TEMPORAL_ADDRESS must be host:port without protocol')
  }
  if (!address.includes(':')) {
    throw new Error('TEMPORAL_ADDRESS must include a port')
  }
  return address
}

function normalizeTemporalName(value: string | null, fallback: string, label: string): string {
  const resolved = value || fallback
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(resolved)) {
    throw new Error(`${label} contains unsupported characters`)
  }
  return resolved
}

export function resolveTemporalRuntimeConfig(env: TemporalEnv = process.env): TemporalRuntimeConfig {
  return {
    address: normalizeTemporalAddress(readTrimmedEnv(env, 'TEMPORAL_ADDRESS')),
    namespace: normalizeTemporalName(
      readTrimmedEnv(env, 'TEMPORAL_NAMESPACE'),
      TEMPORAL_DEFAULT_NAMESPACE,
      'TEMPORAL_NAMESPACE',
    ),
    taskQueue: normalizeTemporalName(
      readTrimmedEnv(env, 'TEMPORAL_TASK_QUEUE'),
      TEMPORAL_DEFAULT_TASK_QUEUE,
      'TEMPORAL_TASK_QUEUE',
    ),
  }
}
