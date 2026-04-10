import OpenAI from 'openai'
import { finalizeGeneratedStreamResult } from '../chat-stream-shared'
import { getCompletionParts } from '../completion-parts'
import { emitStreamChunk, emitStreamStage } from '../stream-helpers'
import { withStreamChunkTimeout } from '../stream-timeout'
import type { ChatCompletionStreamCallbacks, ChatMessage } from '../types'
import { extractStreamDeltaParts } from '../utils'

type StreamStepMeta = Parameters<typeof emitStreamStage>[1]
type StreamState = { text: string; reasoning: string; seq: number }
type OpenAIStreamWithFinal = AsyncIterable<unknown> & {
  finalChatCompletion?: () => Promise<OpenAI.Chat.Completions.ChatCompletion>
}

export async function runOpenRouterStreamAdapter(input: {
  resolvedModelId: string
  modelKey: string
  messages: ChatMessage[]
  apiKey?: string
  baseUrl: string
  temperature: number
  reasoning: boolean
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high'
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  userId: string
  projectId?: string
  action?: string
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const client = new OpenAI({
    baseURL: input.baseUrl,
    apiKey: input.apiKey,
  })
  const extraParams: Record<string, unknown> = input.reasoning
    ? { reasoning: { effort: input.reasoningEffort } }
    : {}

  emitStreamStage(input.callbacks, input.streamStep, 'streaming', 'openrouter')
  const stream = await client.chat.completions.create({
    model: input.resolvedModelId,
    messages: input.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    ...(input.reasoning ? {} : { temperature: input.temperature }),
    stream: true,
    ...extraParams,
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming)

  const streamedState = await streamOpenRouterChunks({
    stream: stream as AsyncIterable<unknown>,
    callbacks: input.callbacks,
    streamStep: input.streamStep,
  })
  const finalState = await syncOpenRouterFinalCompletion({
    stream: stream as OpenAIStreamWithFinal,
    state: streamedState,
    callbacks: input.callbacks,
    streamStep: input.streamStep,
  })

  return finalizeGeneratedStreamResult({
    callbacks: input.callbacks,
    streamStep: input.streamStep,
    userId: input.userId,
    projectId: input.projectId,
    provider: 'openrouter',
    modelId: input.resolvedModelId,
    modelKey: input.modelKey,
    action: input.action,
    text: finalState.text,
    reasoning: finalState.reasoning,
    usage: finalState.finalCompletion
      ? {
        promptTokens: Number(finalState.finalCompletion.usage?.prompt_tokens ?? 0),
        completionTokens: Number(finalState.finalCompletion.usage?.completion_tokens ?? 0),
      }
      : undefined,
  })
}

async function streamOpenRouterChunks(input: {
  stream: AsyncIterable<unknown>
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
}): Promise<StreamState> {
  let text = ''
  let reasoning = ''
  let seq = 1

  for await (const part of withStreamChunkTimeout(input.stream)) {
    const { textDelta, reasoningDelta } = extractStreamDeltaParts(part)
    if (reasoningDelta) {
      reasoning += reasoningDelta
      seq = emitDelta({
        callbacks: input.callbacks,
        streamStep: input.streamStep,
        kind: 'reasoning',
        delta: reasoningDelta,
        seq,
        lane: 'reasoning',
      })
    }
    if (textDelta) {
      text += textDelta
      seq = emitDelta({
        callbacks: input.callbacks,
        streamStep: input.streamStep,
        kind: 'text',
        delta: textDelta,
        seq,
        lane: 'main',
      })
    }
  }

  return { text, reasoning, seq }
}

async function syncOpenRouterFinalCompletion(input: {
  stream: OpenAIStreamWithFinal
  state: StreamState
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
}): Promise<StreamState & { finalCompletion: OpenAI.Chat.Completions.ChatCompletion | null }> {
  const finalChatCompletion = input.stream.finalChatCompletion
  if (typeof finalChatCompletion !== 'function') {
    return { ...input.state, finalCompletion: null }
  }

  try {
    const finalCompletion = await finalChatCompletion.call(input.stream)
    const finalParts = getCompletionParts(finalCompletion)
    const reasoning = syncFinalPart({
      current: input.state.reasoning,
      next: finalParts.reasoning,
      callbacks: input.callbacks,
      streamStep: input.streamStep,
      seq: input.state.seq,
      kind: 'reasoning',
      lane: 'reasoning',
    })
    const text = syncFinalPart({
      current: input.state.text,
      next: finalParts.text,
      callbacks: input.callbacks,
      streamStep: input.streamStep,
      seq: reasoning.seq,
      kind: 'text',
      lane: 'main',
    })
    return {
      text: text.value,
      reasoning: reasoning.value,
      seq: text.seq,
      finalCompletion,
    }
  } catch {
    return { ...input.state, finalCompletion: null }
  }
}

function syncFinalPart(input: {
  current: string
  next: string
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  seq: number
  kind: 'text' | 'reasoning'
  lane: 'main' | 'reasoning'
}) {
  if (!input.next || input.next === input.current) {
    return { value: input.current, seq: input.seq }
  }
  const delta = input.next.startsWith(input.current)
    ? input.next.slice(input.current.length)
    : input.next
  return {
    value: input.next,
    seq: emitDelta({
      callbacks: input.callbacks,
      streamStep: input.streamStep,
      kind: input.kind,
      delta,
      seq: input.seq,
      lane: input.lane,
    }),
  }
}

function emitDelta(input: {
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  kind: 'text' | 'reasoning'
  delta: string
  seq: number
  lane: 'main' | 'reasoning'
}) {
  if (!input.delta) return input.seq
  emitStreamChunk(input.callbacks, input.streamStep, {
    kind: input.kind,
    delta: input.delta,
    seq: input.seq,
    lane: input.lane,
  })
  return input.seq + 1
}
