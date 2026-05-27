import { createHash } from 'node:crypto'
import { ApiError } from '@/lib/api-errors'
import { executeAiTextStep } from '@/lib/ai-runtime'
import type { AiStepExecutionResult, AiTextMessages } from '@/lib/ai-runtime/types'
import { withTextBilling } from '@/lib/billing/service'
import { getProjectModelConfig } from '@/lib/config-service'
import { safeParseJson } from '@/lib/json-repair'
import {
  buildProductionWorkflowInstruction,
  parseProductionNodeOutput,
  type EpisodePlan,
  type ProductionPrepDocument,
  type ProductionSourceMode,
} from '@/lib/production-bible'
import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-contract/node-types'
import type { NormalizedEpisodePlanningParams } from './episode-params'
import type { NormalizedProductionPrepExtractParams } from './extract-params'
import { assertGeneratedProductionPrepDocument } from './validation'

const MAX_OUTPUT_TOKENS = 2400
const MIN_MAX_INPUT_TOKENS = 1200
const APPROX_TOKENS_PER_CHAR = 1.2

export type ProductionPrepLlmDependencies = Readonly<{
  resolveModel?: (params: { projectId: string; userId: string }) => Promise<string>
  executeText?: (input: Parameters<typeof executeAiTextStep>[0]) => Promise<AiStepExecutionResult>
  billText?: <T>(params: {
    userId: string
    projectId: string
    model: string
    action: string
    billingKey: string
    maxInputTokens: number
    maxOutputTokens: number
    metadata: Record<string, unknown>
    execute: () => Promise<T>
  }) => Promise<T>
}>

export type ProductionPrepLlmResult<T> = Readonly<{
  output: T
  model: string
  usage: AiStepExecutionResult['usage']
}>

function sourceDigest(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function summarizeGeneratedSource(params: {
  operation: 'extract' | 'plan-episodes'
  sourceText?: string
  sourceMode?: ProductionSourceMode
  at: string
  model: string
  config?: Record<string, unknown>
}): Record<string, unknown> {
  const sourceText = params.sourceText || ''
  return {
    operation: params.operation,
    at: params.at,
    model: params.model,
    ...(params.sourceMode ? { sourceMode: params.sourceMode } : {}),
    ...(sourceText ? { sourceDigest: sourceDigest(sourceText), sourceLength: sourceText.length } : {}),
    ...(params.config ? { config: params.config } : {}),
  }
}

function maxInputTokens(messages: readonly AiTextMessages[number][]): number {
  const chars = messages.reduce((sum, message) => sum + message.content.length, 0)
  return Math.max(MIN_MAX_INPUT_TOKENS, Math.ceil(chars * APPROX_TOKENS_PER_CHAR))
}

async function resolveModel(params: {
  projectId: string
  userId: string
  deps?: ProductionPrepLlmDependencies
}): Promise<string> {
  if (params.deps?.resolveModel) return await params.deps.resolveModel(params)
  const config = await getProjectModelConfig(params.projectId, params.userId)
  if (!config.analysisModel) {
    throw new ApiError('MISSING_CONFIG', {
      code: 'PRODUCTION_PREP_ANALYSIS_MODEL_REQUIRED',
      message: 'analysisModel is required for production prep generation',
    })
  }
  return config.analysisModel
}

async function runText(params: {
  projectId: string
  userId: string
  action: string
  billingKey: string
  model: string
  messages: AiTextMessages
  temperature: number
  metadata: Record<string, unknown>
  deps?: ProductionPrepLlmDependencies
}): Promise<AiStepExecutionResult> {
  const execute = async () => await (params.deps?.executeText || executeAiTextStep)({
    userId: params.userId,
    projectId: params.projectId,
    model: params.model,
    messages: params.messages,
    action: params.action,
    temperature: params.temperature,
    reasoning: true,
    reasoningEffort: 'medium',
    meta: {
      stepId: params.action,
      stepAttempt: 1,
      stepTitle: params.action,
      stepIndex: 1,
      stepTotal: 1,
    },
  })
  const billParams = {
    userId: params.userId,
    projectId: params.projectId,
    model: params.model,
    action: params.action,
    billingKey: params.billingKey,
    maxInputTokens: maxInputTokens(params.messages),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    metadata: params.metadata,
    execute,
  }
  if (params.deps?.billText) return await params.deps.billText(billParams)
  return await withTextBilling(
    params.userId,
    params.model,
    billParams.maxInputTokens,
    MAX_OUTPUT_TOKENS,
    {
      projectId: params.projectId,
      action: params.action,
      billingKey: params.billingKey,
      metadata: params.metadata,
    },
    execute,
  )
}

function buildMessages(params: {
  instruction: string
  payload: Record<string, unknown>
}): AiTextMessages {
  return [
    {
      role: 'system',
      content: [
        'You prepare durable film and TV pre-production documents.',
        'Return valid JSON only. Do not wrap the response in Markdown.',
        'Use only the provided source material and confirmed production prep data.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        params.instruction,
        '',
        'Source payload:',
        JSON.stringify(params.payload),
      ].join('\n'),
    },
  ]
}

export async function generateProductionPrepDraft(params: {
  projectId: string
  userId: string
  input: NormalizedProductionPrepExtractParams
  deps?: ProductionPrepLlmDependencies
}): Promise<ProductionPrepLlmResult<ProductionPrepDocument>> {
  const model = await resolveModel(params)
  const instruction = buildProductionWorkflowInstruction({
    nodeType: WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE,
    config: {
      language: params.input.language,
      instruction: params.input.instruction,
    },
  })
  const messages = buildMessages({
    instruction,
    payload: {
      title: params.input.title,
      sourceMode: params.input.sourceMode,
      sourceText: params.input.sourceText,
    },
  })
  const completion = await runText({
    projectId: params.projectId,
    userId: params.userId,
    model,
    messages,
    action: 'production_prep_extract',
    billingKey: `production-prep:extract:${params.projectId}:${sourceDigest(params.input.sourceText)}`,
    temperature: 0.35,
    metadata: { sourceMode: params.input.sourceMode },
    deps: params.deps,
  })
  const rawDocument = parseProductionNodeOutput({
    kind: 'production.prep.document',
    json: safeParseJson(completion.text),
  })
  const document = assertGeneratedProductionPrepDocument({
    ...rawDocument as ProductionPrepDocument,
    sourceMode: params.input.sourceMode,
    title: params.input.title || (rawDocument as ProductionPrepDocument).title,
  })
  return { output: document, model, usage: completion.usage }
}

export async function generateEpisodePlans(params: {
  projectId: string
  userId: string
  document: ProductionPrepDocument
  input: NormalizedEpisodePlanningParams
  deps?: ProductionPrepLlmDependencies
}): Promise<ProductionPrepLlmResult<readonly EpisodePlan[]>> {
  const model = await resolveModel(params)
  const instruction = buildProductionWorkflowInstruction({
    nodeType: WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES,
    config: {
      targetEpisodeCount: params.input.episodeCount,
      targetDurationSeconds: params.input.targetDurationSeconds,
      minDurationSeconds: params.input.minDurationSeconds,
      maxDurationSeconds: params.input.maxDurationSeconds,
      pacing: params.input.pacing,
      language: params.input.language,
      instruction: params.input.instruction,
    },
  })
  const messages = buildMessages({
    instruction,
    payload: {
      productionPrepDocument: params.document,
      episodePlanning: params.input,
    },
  })
  const completion = await runText({
    projectId: params.projectId,
    userId: params.userId,
    model,
    messages,
    action: 'production_prep_plan_episodes',
    billingKey: `production-prep:plan:${params.projectId}:${sourceDigest(JSON.stringify(params.input))}:${params.document.metadata.updatedAt}`,
    temperature: 0.35,
    metadata: { episodeCount: params.input.episodeCount, pacing: params.input.pacing },
    deps: params.deps,
  })
  const output = parseProductionNodeOutput({
    kind: 'production.episode.plan',
    json: safeParseJson(completion.text),
  }) as { episodePlans: EpisodePlan[] }
  return { output: output.episodePlans, model, usage: completion.usage }
}
