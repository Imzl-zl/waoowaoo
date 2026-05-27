import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-contract/node-types'
import type {
  TemporalWorkflowExecutionInput,
  TemporalPublishedWorkflowStepActivityInfo,
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalPublishedWorkflowStepResult,
  TemporalWorkflowRunInput,
} from './types'
import type {
  CreatePublishedWorkflowArtifact,
  ListPublishedWorkflowArtifacts,
  PublishedWorkflowLlmDependencies,
  PublishedWorkflowMediaDependencies,
} from './published-workflow-activity-dependencies'
import { readPublishedWorkflowDependencyPayloads } from './published-workflow-step-context'

export type ExecutePublishedWorkflowStepParams = Readonly<{
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  context: TemporalPublishedWorkflowStepContext
  activityId: string
  activity?: TemporalPublishedWorkflowStepActivityInfo
  createWorkflowArtifact?: CreatePublishedWorkflowArtifact
  listWorkflowArtifacts?: ListPublishedWorkflowArtifacts
  llm?: PublishedWorkflowLlmDependencies
  media?: PublishedWorkflowMediaDependencies
}>

type PublishedWorkflowStepExecutor = (
  params: ExecutePublishedWorkflowStepParams
) => Promise<TemporalPublishedWorkflowStepResult> | TemporalPublishedWorkflowStepResult

type PublishedWorkflowStepSupport = Readonly<{
  supported: boolean
  reason?: string
}>

type PublishedWorkflowStepExecutorRegistration = Readonly<{
  execute: PublishedWorkflowStepExecutor
  support?: (params: {
    nodeType: string
    config: Readonly<Record<string, unknown>>
  }) => PublishedWorkflowStepSupport
}>

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

function readExecutionInput(workflow: TemporalWorkflowRunInput): TemporalWorkflowExecutionInput {
  const value = workflow.payload?.executionInput
  if (value === undefined || value === null) return {}
  if (Array.isArray(value) || typeof value !== 'object') {
    throw new Error('published workflow executionInput must be an object')
  }
  return value as TemporalWorkflowExecutionInput
}

function requireExecutionInputValue(
  input: TemporalWorkflowExecutionInput,
  key: string,
): unknown {
  if (!(key in input) || input[key] === undefined) {
    throw new Error(`published workflow execution input ${key} is required`)
  }
  return input[key]
}

function textFromExecutionInput(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function replaceTemplateTokens(
  template: string,
  context: TemporalPublishedWorkflowStepContext,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (
    _match,
    rawReference: string,
  ) => {
    const selector = rawReference.endsWith('.text') || rawReference.endsWith('.json')
      ? rawReference.slice(rawReference.lastIndexOf('.') + 1)
      : undefined
    const stepKey = selector
      ? rawReference.slice(0, -(selector.length + 1))
      : rawReference
    const dependency = context[stepKey]
    if (!dependency) {
      throw new Error(`published workflow template references unknown step ${stepKey}`)
    }
    if (selector === 'text') return dependency.text
    return JSON.stringify(dependency.artifactPayload)
  })
}

function buildStepResult(input: {
  step: TemporalPublishedWorkflowStep
  activityId: string
  text: string
  artifactPayload: unknown
}): TemporalPublishedWorkflowStepResult {
  return {
    stepKey: input.step.stepKey,
    nodeId: input.step.nodeId,
    nodeType: input.step.nodeType,
    status: 'completed',
    activityId: input.activityId,
    text: input.text,
    artifactPayload: input.artifactPayload,
  }
}

function executeRuntimeSmokeStep(
  params: ExecutePublishedWorkflowStepParams,
): TemporalPublishedWorkflowStepResult {
  const message = requireConfigString(params.step.config, 'message')
  return buildStepResult({
    step: params.step,
    activityId: params.activityId,
    text: message,
    artifactPayload: { message },
  })
}

function executeUserInputStep(
  params: ExecutePublishedWorkflowStepParams,
): TemporalPublishedWorkflowStepResult {
  const outputKey = requireConfigString(params.step.config, 'outputKey')
  const executionInput = readExecutionInput(params.workflow)
  const value = requireExecutionInputValue(executionInput, outputKey)
  const artifactPayload = { [outputKey]: value }
  return buildStepResult({
    step: params.step,
    activityId: params.activityId,
    text: textFromExecutionInput(value),
    artifactPayload,
  })
}

function executeDataTransformStep(
  params: ExecutePublishedWorkflowStepParams,
): TemporalPublishedWorkflowStepResult {
  const mode = requireConfigString(params.step.config, 'mode')
  if (mode === 'map') {
    const artifactPayload = readPublishedWorkflowDependencyPayloads(params.step, params.context)
    return buildStepResult({
      step: params.step,
      activityId: params.activityId,
      text: JSON.stringify(artifactPayload),
      artifactPayload,
    })
  }

  if (mode === 'template') {
    const template = requireConfigString(params.step.config, 'template')
    const text = replaceTemplateTokens(template, params.context)
    return buildStepResult({
      step: params.step,
      activityId: params.activityId,
      text,
      artifactPayload: { text },
    })
  }

  throw new Error(`unsupported data.transform mode: ${mode}`)
}

async function executeArtifactPersistStep(
  params: ExecutePublishedWorkflowStepParams,
): Promise<TemporalPublishedWorkflowStepResult> {
  const { persistPublishedWorkflowArtifact } = await import('./published-workflow-artifacts')
  const artifactPayload = await persistPublishedWorkflowArtifact({
    workflow: params.workflow,
    step: params.step,
    context: params.context,
    createWorkflowArtifact: params.createWorkflowArtifact,
  })
  return buildStepResult({
    step: params.step,
    activityId: params.activityId,
    text: `Persisted ${artifactPayload.artifactType}:${artifactPayload.refId}`,
    artifactPayload,
  })
}

async function executeLlmStep(
  params: ExecutePublishedWorkflowStepParams,
): Promise<TemporalPublishedWorkflowStepResult> {
  const { executePublishedWorkflowLlmStep } = await import('./published-workflow-llm')
  return await executePublishedWorkflowLlmStep({
    workflow: params.workflow,
    step: params.step,
    context: params.context,
    activityId: params.activityId,
    activityAttempt: params.activity?.attempt || 1,
    createWorkflowArtifact: params.createWorkflowArtifact,
    listWorkflowArtifacts: params.listWorkflowArtifacts,
    llm: params.llm,
  })
}

async function executeMediaStep(
  params: ExecutePublishedWorkflowStepParams,
): Promise<TemporalPublishedWorkflowStepResult> {
  const { executePublishedWorkflowMediaStep } = await import('./published-workflow-media')
  return await executePublishedWorkflowMediaStep({
    workflow: params.workflow,
    step: params.step,
    context: params.context,
    activityId: params.activityId,
    activityAttempt: params.activity?.attempt || 1,
    createWorkflowArtifact: params.createWorkflowArtifact,
    listWorkflowArtifacts: params.listWorkflowArtifacts,
    media: params.media,
  })
}

async function executeProductionStep(
  params: ExecutePublishedWorkflowStepParams,
): Promise<TemporalPublishedWorkflowStepResult> {
  const { executePublishedWorkflowProductionStep } = await import('./published-workflow-production')
  return await executePublishedWorkflowProductionStep(params)
}

async function executeHumanReviewStep(
  params: ExecutePublishedWorkflowStepParams,
): Promise<TemporalPublishedWorkflowStepResult> {
  const { executePublishedWorkflowHumanReviewStep } = await import('./published-workflow-production')
  return executePublishedWorkflowHumanReviewStep(params)
}

function supportMediaStep(params: {
  config: Readonly<Record<string, unknown>>
}): PublishedWorkflowStepSupport {
  const mediaKind = params.config.mediaKind
  if (mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio') return { supported: true }
  const value = typeof mediaKind === 'string' && mediaKind.trim() ? mediaKind.trim() : 'missing mediaKind'
  return {
    supported: false,
    reason: `media.generate currently supports image, video, and audio only; received ${value}`,
  }
}

const TEMPORAL_PUBLISHED_WORKFLOW_NODE_EXECUTORS = new Map<string, PublishedWorkflowStepExecutorRegistration>([
  [WORKFLOW_NODE_TYPES.USER_INPUT, { execute: executeUserInputStep }],
  [WORKFLOW_NODE_TYPES.LLM_ANALYSIS, { execute: executeLlmStep }],
  [WORKFLOW_NODE_TYPES.LLM_TRANSFORM, { execute: executeLlmStep }],
  [WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE, { execute: executeProductionStep }],
  [WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES, { execute: executeProductionStep }],
  [WORKFLOW_NODE_TYPES.SCENE_BREAKDOWN, { execute: executeProductionStep }],
  [WORKFLOW_NODE_TYPES.SHOT_PLAN, { execute: executeProductionStep }],
  [WORKFLOW_NODE_TYPES.HUMAN_REVIEW, { execute: executeHumanReviewStep }],
  [WORKFLOW_NODE_TYPES.RUNTIME_SMOKE, { execute: executeRuntimeSmokeStep }],
  [WORKFLOW_NODE_TYPES.DATA_TRANSFORM, { execute: executeDataTransformStep }],
  [WORKFLOW_NODE_TYPES.MEDIA_GENERATE, { execute: executeMediaStep, support: supportMediaStep }],
  [WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST, { execute: executeArtifactPersistStep }],
])

export function getTemporalPublishedWorkflowNodeSupport(params: {
  nodeType: string
  config?: Readonly<Record<string, unknown>>
}): PublishedWorkflowStepSupport {
  const registration = TEMPORAL_PUBLISHED_WORKFLOW_NODE_EXECUTORS.get(params.nodeType)
  if (!registration) return { supported: false }
  if (!registration.support) return { supported: true }
  return registration.support({
    nodeType: params.nodeType,
    config: params.config || {},
  })
}

export function executePublishedWorkflowStepNode(
  params: ExecutePublishedWorkflowStepParams,
): Promise<TemporalPublishedWorkflowStepResult> | TemporalPublishedWorkflowStepResult {
  const registration = TEMPORAL_PUBLISHED_WORKFLOW_NODE_EXECUTORS.get(params.step.nodeType)
  const support = getTemporalPublishedWorkflowNodeSupport({
    nodeType: params.step.nodeType,
    config: params.step.config,
  })
  if (registration && support.supported) return registration.execute(params)
  if (support.reason) {
    throw new Error(`unsupported published workflow node config: ${support.reason}`)
  }
  throw new Error(`unsupported published workflow node type: ${params.step.nodeType}`)
}
