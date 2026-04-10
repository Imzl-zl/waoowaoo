import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { extractGoogleParts, extractGoogleUsage, GoogleEmptyResponseError } from '../providers/google'
import { finalizeGeneratedStreamResult } from '../chat-stream-shared'
import { emitStreamChunk, emitStreamStage } from '../stream-helpers'
import { withStreamChunkTimeout } from '../stream-timeout'
import type { ChatCompletionStreamCallbacks, ChatMessage } from '../types'

type StreamStepMeta = Parameters<typeof emitStreamStage>[1]

type GoogleModelClient = {
  generateContentStream?: (params: unknown) => Promise<unknown>
}

type GoogleChunk = {
  stream?: AsyncIterable<unknown>
}

export async function runGoogleStreamAdapter(input: {
  providerKey: 'google' | 'gemini-compatible'
  providerName: string
  providerId: string
  resolvedModelId: string
  modelKey: string
  messages: ChatMessage[]
  apiKey?: string
  baseUrl?: string
  temperature: number
  reasoning: boolean
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high'
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  userId: string
  projectId?: string
  action?: string
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const googleAiOptions = input.baseUrl
    ? { apiKey: input.apiKey, httpOptions: { baseUrl: input.baseUrl } }
    : { apiKey: input.apiKey }
  const ai = new GoogleGenAI(googleAiOptions)
  const modelClient = (ai as unknown as { models?: GoogleModelClient }).models
  if (!modelClient || typeof modelClient.generateContentStream !== 'function') {
    throw new Error('GOOGLE_STREAM_UNAVAILABLE: google provider does not expose generateContentStream')
  }

  const systemParts = input.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .filter(Boolean)
  const contents = input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))
  const systemInstruction = systemParts.length > 0
    ? { parts: [{ text: systemParts.join('\n') }] }
    : undefined
  const supportsThinkingLevel = input.resolvedModelId.startsWith('gemini-3')
  const thinkingConfig = input.reasoning && supportsThinkingLevel
    ? { thinkingLevel: input.reasoningEffort, includeThoughts: true }
    : undefined

  emitStreamStage(input.callbacks, input.streamStep, 'streaming', input.providerKey)
  const stream = await modelClient.generateContentStream({
    model: input.resolvedModelId,
    contents,
    config: {
      temperature: input.temperature,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  })
  const streamChunk = stream as GoogleChunk
  const streamIterable = streamChunk?.stream || (stream as AsyncIterable<unknown>)

  let seq = 1
  let text = ''
  let reasoning = ''
  let lastChunk: unknown = null
  for await (const chunk of withStreamChunkTimeout(streamIterable)) {
    lastChunk = chunk
    const chunkParts = extractGoogleParts(chunk)

    let reasoningDelta = chunkParts.reasoning
    if (reasoningDelta && reasoning && reasoningDelta.startsWith(reasoning)) {
      reasoningDelta = reasoningDelta.slice(reasoning.length)
    }
    if (reasoningDelta) {
      reasoning += reasoningDelta
      emitStreamChunk(input.callbacks, input.streamStep, {
        kind: 'reasoning',
        delta: reasoningDelta,
        seq,
        lane: 'reasoning',
      })
      seq += 1
    }

    let textDelta = chunkParts.text
    if (textDelta && text && textDelta.startsWith(text)) {
      textDelta = textDelta.slice(text.length)
    }
    if (textDelta) {
      text += textDelta
      emitStreamChunk(input.callbacks, input.streamStep, {
        kind: 'text',
        delta: textDelta,
        seq,
        lane: 'main',
      })
      seq += 1
    }
  }

  const usage = extractGoogleUsage(lastChunk)
  if (!text) {
    throw new GoogleEmptyResponseError('stream_empty')
  }

  return finalizeGeneratedStreamResult({
    callbacks: input.callbacks,
    streamStep: input.streamStep,
    userId: input.userId,
    projectId: input.projectId,
    provider: input.providerKey,
    modelId: input.resolvedModelId,
    modelKey: input.modelKey,
    action: input.action,
    text,
    reasoning,
    usage,
  })
}

