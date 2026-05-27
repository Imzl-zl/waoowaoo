import { safeParseJson } from '@/lib/json-repair'
import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-contract/node-types'
import type {
  PublishedWorkflowLlmMessage,
  PublishedWorkflowLlmStepResult,
} from './published-workflow-activity-dependencies'

const MIN_MAX_INPUT_TOKENS = 1200
const APPROX_TOKENS_PER_CHAR = 1.2

export function buildPublishedWorkflowLlmMessages(params: {
  instruction: string
  outputFormat: string
  dependencies: Record<string, unknown>
}): PublishedWorkflowLlmMessage[] {
  const formatInstruction = params.outputFormat === 'json'
    ? 'Return valid JSON only. Do not wrap it in Markdown.'
    : 'Return plain text only.'
  return [
    {
      role: 'system',
      content: [
        'You are executing one node in a visual workflow.',
        'Use only the provided instruction and upstream step outputs.',
        formatInstruction,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        params.instruction,
        '',
        'Upstream step outputs:',
        JSON.stringify(params.dependencies),
      ].join('\n'),
    },
  ]
}

export function publishedWorkflowLlmMaxInputTokens(
  messages: readonly PublishedWorkflowLlmMessage[],
): number {
  const chars = messages.reduce((sum, message) => sum + message.content.length, 0)
  return Math.max(MIN_MAX_INPUT_TOKENS, Math.ceil(chars * APPROX_TOKENS_PER_CHAR))
}

export function publishedWorkflowLlmAction(nodeType: string): string {
  if (nodeType === WORKFLOW_NODE_TYPES.LLM_ANALYSIS) return 'published_workflow_llm_analysis'
  if (
    nodeType === WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE
    || nodeType === WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES
    || nodeType === WORKFLOW_NODE_TYPES.SCENE_BREAKDOWN
    || nodeType === WORKFLOW_NODE_TYPES.SHOT_PLAN
  ) {
    return 'published_workflow_production_prep'
  }
  return 'published_workflow_llm_transform'
}

export function buildPublishedWorkflowLlmOutputPayload(params: {
  outputFormat: string
  model: string
  completion: PublishedWorkflowLlmStepResult
}): unknown {
  const base = {
    text: params.completion.text,
    reasoning: params.completion.reasoning,
    usage: params.completion.usage,
    model: params.model,
  }
  if (params.outputFormat === 'json') {
    return {
      ...base,
      json: safeParseJson(params.completion.text),
    }
  }
  return base
}
