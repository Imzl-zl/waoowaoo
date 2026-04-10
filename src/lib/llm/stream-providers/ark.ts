import OpenAI from 'openai'
import { finalizeGeneratedStreamResult } from '../chat-stream-shared'
import { emitStreamChunk, emitStreamStage } from '../stream-helpers'
import { withStreamChunkTimeout } from '../stream-timeout'
import type { ChatCompletionStreamCallbacks, ChatMessage } from '../types'

type StreamStepMeta = Parameters<typeof emitStreamStage>[1]

export async function runArkStreamAdapter(input: {
  providerId: string
  resolvedModelId: string
  modelKey: string
  messages: ChatMessage[]
  apiKey?: string
  temperature: number
  reasoning: boolean
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  userId: string
  projectId?: string
  action?: string
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  if (!input.apiKey) {
    throw new Error(`PROVIDER_API_KEY_MISSING: ${input.providerId}`)
  }
  const { arkResponsesStream, convertChatMessagesToArkInput, buildArkThinkingParam } = await import('@/lib/ark-llm')
  const arkThinkingParams = buildArkThinkingParam(input.resolvedModelId, input.reasoning)

  const { stream: arkStream, result: getResult } = arkResponsesStream({
    apiKey: input.apiKey,
    model: input.resolvedModelId,
    input: convertChatMessagesToArkInput(input.messages),
    temperature: input.temperature,
    thinking: arkThinkingParams.thinking,
  })

  emitStreamStage(input.callbacks, input.streamStep, 'streaming', input.providerId)
  let seq = 1
  for await (const chunk of withStreamChunkTimeout(arkStream as AsyncIterable<unknown>)) {
    const arkChunk = chunk as { kind: 'reasoning' | 'text'; delta: string }
    if (arkChunk.kind === 'reasoning' && arkChunk.delta) {
      emitStreamChunk(input.callbacks, input.streamStep, {
        kind: 'reasoning',
        delta: arkChunk.delta,
        seq,
        lane: 'reasoning',
      })
      seq += 1
    }
    if (arkChunk.kind === 'text' && arkChunk.delta) {
      emitStreamChunk(input.callbacks, input.streamStep, {
        kind: 'text',
        delta: arkChunk.delta,
        seq,
        lane: 'main',
      })
      seq += 1
    }
  }

  const arkResult = await getResult()
  return finalizeGeneratedStreamResult({
    callbacks: input.callbacks,
    streamStep: input.streamStep,
    userId: input.userId,
    projectId: input.projectId,
    provider: input.providerId,
    modelId: input.resolvedModelId,
    modelKey: input.modelKey,
    action: input.action,
    text: arkResult.text,
    reasoning: arkResult.reasoning,
    usage: arkResult.usage,
  })
}
