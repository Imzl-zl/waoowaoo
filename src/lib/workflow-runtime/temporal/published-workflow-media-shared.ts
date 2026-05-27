import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepResult,
} from './types'

export function requireConfigString(
  config: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = config[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`published workflow step config ${key} is required`)
  }
  return value.trim()
}

export function buildMediaPrompt(input: {
  prompt: string
  dependencies: Record<string, unknown>
}): string {
  if (Object.keys(input.dependencies).length === 0) return input.prompt
  return [
    input.prompt,
    '',
    'Upstream workflow context:',
    JSON.stringify(input.dependencies),
  ].join('\n')
}

export function buildMediaStepResult(params: {
  step: TemporalPublishedWorkflowStep
  activityId: string
  text: string
  artifactPayload: unknown
}): TemporalPublishedWorkflowStepResult {
  return {
    stepKey: params.step.stepKey,
    nodeId: params.step.nodeId,
    nodeType: params.step.nodeType,
    status: 'completed',
    activityId: params.activityId,
    text: params.text,
    artifactPayload: params.artifactPayload,
  }
}

export function publishedWorkflowMediaBillingKey(params: {
  runId: string
  stepKey: string
  activityAttempt: number
}) {
  return [
    'published-workflow',
    params.runId,
    params.stepKey,
    `attempt-${params.activityAttempt}`,
  ].join(':')
}
