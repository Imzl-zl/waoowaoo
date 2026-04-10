import OpenAI from 'openai'
import { buildOpenAIChatCompletion } from './providers/openai-compat'
import { buildReasoningAwareContent } from './utils'
import { getCompletionParts } from './completion-parts'
import {
  completionUsageSummary,
  logLlmRawOutput,
  recordCompletionUsage,
} from './runtime-shared'
import {
  emitStreamChunk,
  emitStreamStage,
} from './stream-helpers'

type StreamStepMeta = Parameters<typeof emitStreamStage>[1]
type StreamCallbacks = Parameters<typeof emitStreamStage>[0]

export function finalizeCompletionFromParts(input: {
  completion: OpenAI.Chat.Completions.ChatCompletion
  callbacks?: StreamCallbacks
  streamStep: StreamStepMeta
  userId: string
  projectId?: string
  provider: string
  modelId: string
  modelKey: string
  action?: string
}): OpenAI.Chat.Completions.ChatCompletion {
  const completionParts = getCompletionParts(input.completion)
  let seq = 1
  if (completionParts.reasoning) {
    emitStreamChunk(input.callbacks, input.streamStep, {
      kind: 'reasoning',
      delta: completionParts.reasoning,
      seq,
      lane: 'reasoning',
    })
    seq += 1
  }
  if (completionParts.text) {
    emitStreamChunk(input.callbacks, input.streamStep, {
      kind: 'text',
      delta: completionParts.text,
      seq,
      lane: 'main',
    })
  }

  logLlmRawOutput({
    userId: input.userId,
    projectId: input.projectId,
    provider: input.provider,
    modelId: input.modelId,
    modelKey: input.modelKey,
    stream: true,
    action: input.action,
    text: completionParts.text,
    reasoning: completionParts.reasoning,
    usage: completionUsageSummary(input.completion),
  })
  recordCompletionUsage(input.modelId, input.completion)
  emitStreamStage(input.callbacks, input.streamStep, 'completed', input.provider)
  input.callbacks?.onComplete?.(completionParts.text, input.streamStep)
  return input.completion
}

export function finalizeGeneratedStreamResult(input: {
  callbacks?: StreamCallbacks
  streamStep: StreamStepMeta
  userId: string
  projectId?: string
  provider: string
  modelId: string
  modelKey: string
  action?: string
  text: string
  reasoning: string
  usage?: { promptTokens: number; completionTokens: number }
}): OpenAI.Chat.Completions.ChatCompletion {
  const completion = buildOpenAIChatCompletion(
    input.modelId,
    buildReasoningAwareContent(input.text, input.reasoning),
    input.usage,
  )
  logLlmRawOutput({
    userId: input.userId,
    projectId: input.projectId,
    provider: input.provider,
    modelId: input.modelId,
    modelKey: input.modelKey,
    stream: true,
    action: input.action,
    text: input.text,
    reasoning: input.reasoning,
    usage: input.usage || null,
  })
  recordCompletionUsage(input.modelId, completion)
  emitStreamStage(input.callbacks, input.streamStep, 'completed', input.provider)
  input.callbacks?.onComplete?.(input.text, input.streamStep)
  return completion
}
