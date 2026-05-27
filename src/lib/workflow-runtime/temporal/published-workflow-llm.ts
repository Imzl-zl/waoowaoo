import type {
  CreatePublishedWorkflowArtifact,
  ListPublishedWorkflowArtifacts,
  PublishedWorkflowLlmDependencies,
} from './published-workflow-activity-dependencies'
import {
  billPublishedWorkflowLlmTextDefault,
  executePublishedWorkflowLlmTextDefault,
  resolvePublishedWorkflowLlmModelDefault,
} from './published-workflow-llm-defaults'
import {
  persistLlmResult,
  publishedWorkflowLlmVersionHash,
  readCachedLlmResult,
} from './published-workflow-llm-cache'
import {
  buildPublishedWorkflowLlmMessages,
  buildPublishedWorkflowLlmOutputPayload,
  publishedWorkflowLlmAction,
  publishedWorkflowLlmMaxInputTokens,
} from './published-workflow-llm-format'
import { readPublishedWorkflowDependencyOutputs } from './published-workflow-step-context'
import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalPublishedWorkflowStepResult,
  TemporalWorkflowRunInput,
} from './types'

const DEFAULT_MAX_OUTPUT_TOKENS = 1200

function requireConfigString(config: Readonly<Record<string, unknown>>, key: string): string {
  const value = config[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`published workflow step config ${key} is required`)
  }
  return value.trim()
}

function optionalConfigNumber(config: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const value = config[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`published workflow step config ${key} must be a finite number`)
  }
  return value
}

function buildStepResult(params: {
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

function billingKey(params: {
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

export async function executePublishedWorkflowLlmStep(params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  context: TemporalPublishedWorkflowStepContext
  activityId: string
  activityAttempt: number
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
  listWorkflowArtifacts?: ListPublishedWorkflowArtifacts
  llm?: PublishedWorkflowLlmDependencies
}): Promise<TemporalPublishedWorkflowStepResult> {
  const instruction = requireConfigString(params.step.config, 'instruction')
  const outputFormat = requireConfigString(params.step.config, 'outputFormat')
  if (outputFormat !== 'text' && outputFormat !== 'json') {
    throw new Error(`unsupported published workflow LLM outputFormat: ${outputFormat}`)
  }

  const dependencies = readPublishedWorkflowDependencyOutputs(params.step, params.context)
  const messages = buildPublishedWorkflowLlmMessages({ instruction, outputFormat, dependencies })
  const action = publishedWorkflowLlmAction(params.step.nodeType)
  const model = await (params.llm?.resolveModel || resolvePublishedWorkflowLlmModelDefault)({
    workflow: params.workflow,
    step: params.step,
  })
  const versionHash = publishedWorkflowLlmVersionHash({
    nodeType: params.step.nodeType,
    stepKey: params.step.stepKey,
    config: params.step.config,
    dependencies,
    model,
  })
  const cached = await readCachedLlmResult({
    workflow: params.workflow,
    step: params.step,
    activityId: params.activityId,
    versionHash,
    listWorkflowArtifacts: params.listWorkflowArtifacts,
  })
  if (cached) return cached

  const executeText = params.llm?.executeText || executePublishedWorkflowLlmTextDefault
  const billText = params.llm?.billText || billPublishedWorkflowLlmTextDefault
  const completion = await billText({
    userId: params.workflow.userId,
    model,
    maxInputTokens: publishedWorkflowLlmMaxInputTokens(messages),
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    projectId: params.workflow.projectId,
    action,
    billingKey: billingKey({
      runId: params.workflow.runId,
      stepKey: params.step.stepKey,
      activityAttempt: params.activityAttempt,
    }),
    metadata: {
      workflowType: params.workflow.workflowType,
      workflowDefinitionVersionId: params.workflow.targetId,
      nodeId: params.step.nodeId,
      nodeType: params.step.nodeType,
      stepKey: params.step.stepKey,
      outputFormat,
      activityAttempt: params.activityAttempt,
    },
    execute: async () => await executeText({
      userId: params.workflow.userId,
      model,
      messages,
      projectId: params.workflow.projectId,
      action,
      meta: {
        stepId: params.step.stepKey,
        stepAttempt: params.step.temporalStep.attempt,
        stepTitle: params.step.nodeTitle,
        stepIndex: params.step.temporalStep.stepIndex,
        stepTotal: params.step.temporalStep.stepTotal,
      },
      temperature: optionalConfigNumber(params.step.config, 'temperature'),
      reasoning: true,
      reasoningEffort: 'medium',
    }),
  })

  const result = buildStepResult({
    step: params.step,
    activityId: params.activityId,
    text: completion.text,
    artifactPayload: buildPublishedWorkflowLlmOutputPayload({ outputFormat, model, completion }),
  })
  await persistLlmResult({
    workflow: params.workflow,
    step: params.step,
    versionHash,
    result,
    createWorkflowArtifact: params.createWorkflowArtifact,
  })
  return result
}
