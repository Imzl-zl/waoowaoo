import { describe, expect, it, vi } from 'vitest'
import { RUN_EVENT_TYPE, type RunEventInput } from '@/lib/run-runtime/types'
import {
  publishTemporalRunLifecycleEvent,
  type TemporalRunEventPublisher,
} from '@/lib/workflow-runtime/temporal/events'

const workflow = {
  runId: ' run-1 ',
  workflowType: 'story_to_script_run',
  projectId: ' project-1 ',
  userId: ' user-1 ',
  taskId: 'task-1',
  targetType: 'NovelPromotionEpisode',
  targetId: ' episode-1 ',
  payload: { prompt: 'hello' },
}

function buildPublishedMessage(input: RunEventInput) {
  return {
    id: 'event-1',
    type: 'run.event',
    runId: input.runId,
    projectId: input.projectId,
    userId: input.userId,
    seq: 7,
    eventType: input.eventType,
    stepKey: input.stepKey || null,
    attempt: input.attempt || null,
    lane: input.lane || null,
    idempotencyKey: input.idempotencyKey || null,
    payload: input.payload || null,
    ts: '2026-05-02T12:00:00.000Z',
  }
}

describe('Temporal lifecycle run event publishing', () => {
  it('publishes normalized lifecycle run events through the injected publisher', async () => {
    const publishEvent: TemporalRunEventPublisher = vi.fn(async (input) => buildPublishedMessage(input))

    const message = await publishTemporalRunLifecycleEvent({
      workflow,
      eventType: RUN_EVENT_TYPE.STEP_START,
      stepKey: ' temporal.smoke ',
      attempt: 1.7,
      payload: { stepTitle: 'Temporal smoke lifecycle' },
    }, publishEvent)

    expect(publishEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      projectId: 'project-1',
      userId: 'user-1',
      eventType: RUN_EVENT_TYPE.STEP_START,
      stepKey: 'temporal.smoke',
      attempt: 1,
      idempotencyKey: expect.stringMatching(/^temporal-run-event:/),
    }))
    expect(message).toMatchObject({
      type: 'run.event',
      runId: 'run-1',
      seq: 7,
      eventType: RUN_EVENT_TYPE.STEP_START,
      stepKey: 'temporal.smoke',
    })
  })

  it('rejects high-frequency chunks before publishing', async () => {
    const publishEvent: TemporalRunEventPublisher = vi.fn(async (input) => buildPublishedMessage(input))

    await expect(publishTemporalRunLifecycleEvent({
      workflow,
      eventType: RUN_EVENT_TYPE.STEP_CHUNK,
      stepKey: 'temporal.smoke',
      payload: { delta: 'a' },
    }, publishEvent)).rejects.toThrow('step.chunk is a high-frequency stream event')
    expect(publishEvent).not.toHaveBeenCalled()
  })

  it('exposes publisher failures for Temporal Activity retry', async () => {
    const publishEvent: TemporalRunEventPublisher = vi.fn(async () => {
      throw new Error('redis publish failed')
    })

    await expect(publishTemporalRunLifecycleEvent({
      workflow,
      eventType: RUN_EVENT_TYPE.RUN_START,
      payload: { source: 'temporal' },
    }, publishEvent)).rejects.toThrow('redis publish failed')
  })
})
