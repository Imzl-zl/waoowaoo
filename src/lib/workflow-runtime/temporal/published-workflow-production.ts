import {
  buildProductionWorkflowInstruction,
  parseProductionNodeOutput,
  productionNodeOutputKind,
} from '@/lib/production-bible'
import { executePublishedWorkflowLlmStep } from './published-workflow-llm'
import { readPublishedWorkflowDependencyPayloads } from './published-workflow-step-context'
import type { ExecutePublishedWorkflowStepParams } from './published-workflow-activities'
import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepResult,
} from './types'

function optionalConfigString(
  config: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = config[key]
  return typeof value === 'string' ? value.trim() : ''
}

function optionalConfigBoolean(
  config: Readonly<Record<string, unknown>>,
  key: string,
  fallback: boolean,
): boolean {
  const value = config[key]
  return typeof value === 'boolean' ? value : fallback
}

function extractLlmJsonPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('production workflow LLM output payload must be an object')
  }
  const json = (payload as { json?: unknown }).json
  if (json === undefined) {
    throw new Error('production workflow LLM output payload is missing json')
  }
  return json
}

function productionLlmStep(step: TemporalPublishedWorkflowStep): TemporalPublishedWorkflowStep {
  return {
    ...step,
    config: {
      ...step.config,
      instruction: buildProductionWorkflowInstruction({
        nodeType: step.nodeType,
        config: step.config,
      }),
      outputFormat: 'json',
      temperature: step.config.temperature ?? 0.35,
    },
  }
}

export async function executePublishedWorkflowProductionStep(
  params: ExecutePublishedWorkflowStepParams,
): Promise<TemporalPublishedWorkflowStepResult> {
  const llmResult = await executePublishedWorkflowLlmStep({
    workflow: params.workflow,
    step: productionLlmStep(params.step),
    context: params.context,
    activityId: params.activityId,
    activityAttempt: params.activity?.attempt || 1,
    createWorkflowArtifact: params.createWorkflowArtifact,
    listWorkflowArtifacts: params.listWorkflowArtifacts,
    llm: params.llm,
  })
  const kind = productionNodeOutputKind(params.step.nodeType)
  const output = parseProductionNodeOutput({
    kind,
    json: extractLlmJsonPayload(llmResult.artifactPayload),
  })
  return {
    ...llmResult,
    text: JSON.stringify(output),
    artifactPayload: {
      kind,
      output,
      llm: llmResult.artifactPayload,
    },
  }
}

export function executePublishedWorkflowHumanReviewStep(
  params: ExecutePublishedWorkflowStepParams,
): TemporalPublishedWorkflowStepResult {
  const checkpointName = optionalConfigString(params.step.config, 'checkpointName')
  if (!checkpointName) {
    throw new Error('published workflow step config checkpointName is required')
  }
  const artifactPayload = {
    checkpointName,
    required: optionalConfigBoolean(params.step.config, 'required', true),
    instructions: optionalConfigString(params.step.config, 'instructions'),
    dependencies: readPublishedWorkflowDependencyPayloads(params.step, params.context),
  }
  return {
    stepKey: params.step.stepKey,
    nodeId: params.step.nodeId,
    nodeType: params.step.nodeType,
    status: 'completed',
    activityId: params.activityId,
    text: JSON.stringify(artifactPayload),
    artifactPayload,
  }
}
