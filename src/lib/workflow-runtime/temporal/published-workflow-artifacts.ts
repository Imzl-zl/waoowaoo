import { createHash } from 'node:crypto'
import { createArtifact } from '@/lib/run-runtime/service'
import type { CreatePublishedWorkflowArtifact } from './published-workflow-activity-dependencies'
import { readPublishedWorkflowDependencyPayloads } from './published-workflow-step-context'
import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalWorkflowRunInput,
} from './types'

type JsonRecord = Record<string, unknown>

function requireConfigString(
  config: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = config[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`published workflow step config ${key} is required`)
  }
  return value.trim()
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue)
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => [key, stableJsonValue(entryValue)])
  return Object.fromEntries(entries)
}

function versionHashFor(payload: JsonRecord): string {
  const stable = JSON.stringify(stableJsonValue(payload))
  return createHash('sha256').update(stable).digest('hex')
}

export async function persistPublishedWorkflowArtifact(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  context: TemporalPublishedWorkflowStepContext
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
}) {
  const artifactType = requireConfigString(params.step.config, 'artifactType')
  const refId = requireConfigString(params.step.config, 'refId')
  if (params.step.dependsOn.length === 0) {
    throw new Error(`published workflow artifact.persist step ${params.step.stepKey} requires at least one dependency`)
  }
  const payload = readPublishedWorkflowDependencyPayloads(params.step, params.context)
  const versionHash = versionHashFor(payload)
  const writer = params.createWorkflowArtifact || createArtifact
  const persistedArtifact = await writer({
    runId: params.workflow.runId,
    stepKey: params.step.stepKey,
    artifactType,
    refId,
    versionHash,
    payload,
  })

  return {
    artifactType,
    refId,
    versionHash,
    dependencies: payload,
    persistedArtifact,
  }
}
