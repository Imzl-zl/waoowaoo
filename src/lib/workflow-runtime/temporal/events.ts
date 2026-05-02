import { publishRunEvent } from '@/lib/run-runtime/publisher'
import type { RunEventInput, RunEventType } from '@/lib/run-runtime/types'
import {
  buildTemporalRunLifecycleEventInput,
  type TemporalRunLifecycleEventInput,
} from './read-model'

export type TemporalPublishedRunEvent = Readonly<{
  id: string
  type: string
  runId: string
  projectId: string
  userId: string
  seq: number
  eventType: RunEventType
  stepKey?: string | null
  attempt?: number | null
  lane?: 'text' | 'reasoning' | null
  idempotencyKey?: string | null
  payload?: Record<string, unknown> | null
  ts: string
}>

export type TemporalRunEventPublisher = (
  input: RunEventInput,
) => Promise<TemporalPublishedRunEvent>

export async function publishTemporalRunLifecycleEvent(
  input: TemporalRunLifecycleEventInput,
  publishEvent: TemporalRunEventPublisher = publishRunEvent,
): Promise<TemporalPublishedRunEvent> {
  return await publishEvent(buildTemporalRunLifecycleEventInput(input))
}
