import { describe, expect, it, vi } from 'vitest'
import { RUN_EVENT_TYPE, type RunEventInput } from '@/lib/run-runtime/types'
import {
  buildTemporalRunEventIdempotencyKey,
  buildTemporalRunLifecycleEventInput,
  recordTemporalRunLifecycleEvent,
} from '@/lib/workflow-runtime/temporal/read-model'

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

describe('Temporal read-model lifecycle projection', () => {
  it('builds deterministic idempotent run event input from workflow context', () => {
    const eventInput = buildTemporalRunLifecycleEventInput({
      workflow,
      eventType: RUN_EVENT_TYPE.STEP_COMPLETE,
      stepKey: ' step:analyze ',
      attempt: 1.8,
      payload: { text: 'done' },
    })
    const eventKey = buildTemporalRunEventIdempotencyKey({
      workflow,
      eventType: RUN_EVENT_TYPE.STEP_COMPLETE,
      stepKey: 'step:analyze',
      attempt: 1,
      payload: { text: 'ignored for key' },
    })

    expect(eventInput).toMatchObject({
      runId: 'run-1',
      projectId: 'project-1',
      userId: 'user-1',
      eventType: RUN_EVENT_TYPE.STEP_COMPLETE,
      stepKey: 'step:analyze',
      attempt: 1,
      payload: { text: 'done' },
    })
    expect(eventInput.idempotencyKey).toBe(eventKey)
  })

  it('records lifecycle events through the injected run event writer', async () => {
    const writeRunEvent = vi.fn(async (input: RunEventInput) => ({
      id: '1',
      seq: 1,
      createdAt: '2026-05-02T12:00:00.000Z',
      ...input,
    }))

    const event = await recordTemporalRunLifecycleEvent({
      workflow,
      eventType: RUN_EVENT_TYPE.RUN_START,
      payload: { source: 'temporal' },
    }, writeRunEvent)

    expect(writeRunEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      projectId: 'project-1',
      userId: 'user-1',
      eventType: RUN_EVENT_TYPE.RUN_START,
      idempotencyKey: expect.stringMatching(/^temporal-run-event:/),
    }))
    expect(event).toMatchObject({
      eventType: RUN_EVENT_TYPE.RUN_START,
      seq: 1,
    })
  })

  it('rejects high-frequency stream chunks at the Temporal lifecycle boundary', () => {
    expect(() => buildTemporalRunLifecycleEventInput({
      workflow,
      eventType: RUN_EVENT_TYPE.STEP_CHUNK,
      stepKey: 'step:stream',
      payload: { delta: 'a' },
    })).toThrow('step.chunk is a high-frequency stream event')
  })

  it('exposes invalid lifecycle payloads', () => {
    expect(() => buildTemporalRunLifecycleEventInput({
      workflow,
      eventType: RUN_EVENT_TYPE.RUN_START,
      payload: [] as unknown as Record<string, unknown>,
    })).toThrow('payload must be an object when provided')
  })
})
