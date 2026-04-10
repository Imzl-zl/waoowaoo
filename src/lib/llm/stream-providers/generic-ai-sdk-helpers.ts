import { generateText, streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { shouldUseOpenAIReasoningProviderOptions } from '../reasoning-capability'
import { emitStreamChunk, emitStreamStage } from '../stream-helpers'
import { withStreamChunkTimeout } from '../stream-timeout'
import { llmLogger } from '../runtime-shared'
import type { ChatCompletionStreamCallbacks, ChatMessage } from '../types'
import {
  getConversationMessages,
  getSystemPrompt,
  mapReasoningEffort,
} from '../utils'

export type StreamStepMeta = Parameters<typeof emitStreamStage>[1]
export type AiSdkStreamResult = ReturnType<typeof streamText>
export type AiSdkStreamChunk = { type?: string; text?: string }
export type AiSdkUsage = { inputTokens?: number | null; outputTokens?: number | null } | null | undefined
export type StreamState = { text: string; reasoning: string; seq: number }
export type AiSdkDiagnostics = {
  chunkTypeCounts: Record<string, number>
  streamErrorChunks: unknown[]
  streamFinishReason?: string
  unknownChunkSamples: unknown[]
}
export type AiSdkMetadata = {
  sdkWarnings: unknown[]
  sdkFinishReason?: string
  sdkProviderMetadata?: unknown
  sdkResponseStatus?: number
  sdkResponseHeaders?: Record<string, string>
}

const LIFECYCLE_TYPES = new Set(['text-delta', 'reasoning-delta', 'start', 'start-step', 'finish-step', 'finish', 'error'])
const RESPONSE_HEADER_ALLOWLIST = new Set(['content-type', 'x-ratelimit-remaining-requests', 'x-request-id'])

export function buildAiSdkProviderOptions(input: {
  providerKey: string
  providerApiMode?: string
  reasoning: boolean
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high'
  modelId: string
}) {
  const normalizedApiMode = normalizeProviderApiMode(input.providerApiMode)
  const isNativeOpenAIReasoning = shouldUseOpenAIReasoningProviderOptions({
    providerKey: input.providerKey,
    providerApiMode: normalizedApiMode,
    modelId: input.modelId,
  })
  const aiSdkProviderOptions = input.reasoning && isNativeOpenAIReasoning
    ? {
      openai: {
        reasoningEffort: mapReasoningEffort(input.reasoningEffort),
        forceReasoning: true as const,
      },
    }
    : undefined

  return { aiSdkProviderOptions, isNativeOpenAIReasoning }
}

export function buildAiSdkStreamParams(input: {
  aiOpenAI: ReturnType<typeof createOpenAI>
  resolvedModelId: string
  messages: ChatMessage[]
  temperature: number
  reasoning: boolean
  maxRetries: number
  aiSdkProviderOptions?: {
    openai: { reasoningEffort: 'low' | 'medium' | 'high'; forceReasoning: true }
  }
}): Parameters<typeof streamText>[0] {
  return {
    model: input.aiOpenAI.chat(input.resolvedModelId),
    system: getSystemPrompt(input.messages),
    messages: getConversationMessages(input.messages) as ModelMessage[],
    ...(input.reasoning ? {} : { temperature: input.temperature }),
    maxRetries: input.maxRetries,
    ...(input.aiSdkProviderOptions ? { providerOptions: input.aiSdkProviderOptions } : {}),
  }
}

export async function streamAiSdkChunks(input: {
  result: AiSdkStreamResult
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
}): Promise<AiSdkDiagnostics & StreamState> {
  let text = ''
  let reasoning = ''
  let seq = 1
  const chunkTypeCounts: Record<string, number> = {}
  const streamErrorChunks: unknown[] = []
  let streamFinishReason: string | undefined
  const unknownChunkSamples: unknown[] = []

  for await (const chunk of withStreamChunkTimeout(input.result.fullStream as AsyncIterable<AiSdkStreamChunk>)) {
    const chunkType = chunk?.type || 'unknown'
    chunkTypeCounts[chunkType] = (chunkTypeCounts[chunkType] || 0) + 1
    if (chunkType === 'reasoning-delta' && typeof chunk.text === 'string' && chunk.text) {
      reasoning += chunk.text
      seq = emitDelta({
        callbacks: input.callbacks,
        streamStep: input.streamStep,
        kind: 'reasoning',
        delta: chunk.text,
        seq,
        lane: 'reasoning',
      })
    }
    if (chunkType === 'text-delta' && typeof chunk.text === 'string' && chunk.text) {
      text += chunk.text
      seq = emitDelta({
        callbacks: input.callbacks,
        streamStep: input.streamStep,
        kind: 'text',
        delta: chunk.text,
        seq,
        lane: 'main',
      })
    }
    if (chunkType === 'error') streamErrorChunks.push((chunk as Record<string, unknown>).error ?? chunk)
    if (chunkType === 'finish-step' || chunkType === 'finish') {
      const finishReason = (chunk as Record<string, unknown>).finishReason
      if (typeof finishReason === 'string' && finishReason) streamFinishReason = finishReason
    }
    if (!LIFECYCLE_TYPES.has(chunkType) && unknownChunkSamples.length < 5) {
      unknownChunkSamples.push(chunk)
    }
  }

  return { text, reasoning, seq, chunkTypeCounts, streamErrorChunks, streamFinishReason, unknownChunkSamples }
}

export async function collectAiSdkMetadata(result: AiSdkStreamResult): Promise<AiSdkMetadata> {
  const sdkWarnings = await readAiSdkWarnings(result)
  const sdkFinishReason = await readAiSdkFinishReason(result)
  const sdkProviderMetadata = await readAiSdkProviderMetadata(result)
  const responseInfo = await readAiSdkResponseInfo(result)

  return {
    sdkWarnings,
    sdkFinishReason,
    sdkProviderMetadata,
    sdkResponseStatus: responseInfo.sdkResponseStatus,
    sdkResponseHeaders: responseInfo.sdkResponseHeaders,
  }
}

export async function resolveAiSdkFinalState(input: {
  result: AiSdkStreamResult
  state: StreamState
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
}): Promise<StreamState> {
  const reasoning = await syncResolvedOutput({
    current: input.state.reasoning,
    resolved: input.result.reasoningText,
    callbacks: input.callbacks,
    streamStep: input.streamStep,
    seq: input.state.seq,
    kind: 'reasoning',
    lane: 'reasoning',
  })
  const text = await syncResolvedOutput({
    current: input.state.text,
    resolved: input.result.text,
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
  }
}

export async function runAiSdkFallbackWithoutReasoningOptions(input: {
  aiOpenAI: ReturnType<typeof createOpenAI>
  resolvedModelId: string
  messages: ChatMessage[]
  temperature: number
  maxRetries: number
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  userId: string
  projectId?: string
  providerName: string
  modelKey: string
  action?: string
  finishReason: string
  state: StreamState
  usage: AiSdkUsage
}): Promise<{ state: StreamState; usage: AiSdkUsage }> {
  llmLogger.warn({
    audit: false,
    action: 'llm.stream.reasoning_fallback',
    message: '[LLM] empty stream with reasoning options, retrying once without provider reasoning options',
    userId: input.userId,
    projectId: input.projectId,
    provider: input.providerName,
    details: {
      model: { id: input.resolvedModelId, key: input.modelKey },
      action: input.action ?? null,
      finishReason: input.finishReason,
    },
  })

  try {
    const fallbackResult = await generateText({
      model: input.aiOpenAI.chat(input.resolvedModelId),
      system: getSystemPrompt(input.messages),
      messages: getConversationMessages(input.messages) as ModelMessage[],
      temperature: input.temperature,
      maxRetries: input.maxRetries,
    })
    let seq = input.state.seq
    const fallbackReasoning = fallbackResult.reasoningText || ''
    const fallbackText = fallbackResult.text || ''
    if (fallbackReasoning) {
      seq = emitDelta({
        callbacks: input.callbacks,
        streamStep: input.streamStep,
        kind: 'reasoning',
        delta: fallbackReasoning,
        seq,
        lane: 'reasoning',
      })
    }
    if (fallbackText) {
      seq = emitDelta({
        callbacks: input.callbacks,
        streamStep: input.streamStep,
        kind: 'text',
        delta: fallbackText,
        seq,
        lane: 'main',
      })
    }

    return {
      state: {
        text: fallbackText || input.state.text,
        reasoning: fallbackReasoning || input.state.reasoning,
        seq,
      },
      usage: fallbackResult.usage || fallbackResult.totalUsage || input.usage,
    }
  } catch (fallbackError) {
    llmLogger.warn({
      audit: false,
      action: 'llm.stream.reasoning_fallback_failed',
      message: '[LLM] fallback without reasoning options failed',
      userId: input.userId,
      projectId: input.projectId,
      provider: input.providerName,
      details: {
        model: { id: input.resolvedModelId, key: input.modelKey },
        action: input.action ?? null,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      },
    })
    return {
      state: input.state,
      usage: input.usage,
    }
  }
}

export function throwEmptyAiSdkResponse(input: {
  userId: string
  projectId?: string
  providerName: string
  resolvedModelId: string
  modelKey: string
  action?: string
  reasoning: boolean
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high'
  isNativeOpenAIReasoning: boolean
  state: StreamState
  diagnostics: AiSdkDiagnostics
  metadata: AiSdkMetadata
}): never {
  llmLogger.warn({
    audit: false,
    action: 'llm.stream.empty_response',
    message: '[LLM] AI SDK 流式返回空内容',
    userId: input.userId,
    projectId: input.projectId,
    provider: input.providerName,
    details: {
      model: { id: input.resolvedModelId, key: input.modelKey },
      action: input.action ?? null,
      reasoningEnabled: input.reasoning,
      isNativeOpenAIReasoning: input.isNativeOpenAIReasoning,
      reasoningEffort: input.reasoningEffort,
      chunkTypeCounts: input.diagnostics.chunkTypeCounts,
      sdkWarnings: input.metadata.sdkWarnings,
      streamErrors: input.diagnostics.streamErrorChunks.length > 0 ? input.diagnostics.streamErrorChunks : undefined,
      finishReason: input.metadata.sdkFinishReason ?? input.diagnostics.streamFinishReason ?? 'unknown',
      providerMetadata: input.metadata.sdkProviderMetadata,
      httpStatus: input.metadata.sdkResponseStatus,
      httpHeaders: input.metadata.sdkResponseHeaders,
      unknownChunks: input.diagnostics.unknownChunkSamples.length > 0 ? input.diagnostics.unknownChunkSamples : undefined,
      streamedReasoningLength: input.state.reasoning.length,
    },
  })

  const finishInfo = input.metadata.sdkFinishReason ?? input.diagnostics.streamFinishReason ?? 'unknown'
  const errDetail = input.diagnostics.streamErrorChunks.length > 0
    ? ` [apiError: ${JSON.stringify(input.diagnostics.streamErrorChunks[0])}]`
    : input.metadata.sdkWarnings.length > 0 ? ` [warnings: ${JSON.stringify(input.metadata.sdkWarnings)}]` : ''
  throw new Error(
    `LLM_EMPTY_RESPONSE: ${input.providerName}::${input.resolvedModelId} 返回空内容` +
    ` [finishReason: ${finishInfo}]` +
    ` [httpStatus: ${input.metadata.sdkResponseStatus ?? 'unknown'}]` +
    errDetail +
    ` [chunks: ${JSON.stringify(input.diagnostics.chunkTypeCounts)}]`,
  )
}

export async function readAiSdkUsage(result: AiSdkStreamResult): Promise<AiSdkUsage> {
  try {
    return await Promise.resolve(result.usage).catch(() => null)
  } catch {
    return null
  }
}

export function normalizeUsage(usage: AiSdkUsage) {
  if (!usage) return undefined
  return {
    promptTokens: Number(usage.inputTokens ?? 0),
    completionTokens: Number(usage.outputTokens ?? 0),
  }
}

function normalizeProviderApiMode(apiMode?: string): 'gemini-sdk' | 'openai-official' | undefined {
  if (apiMode === 'gemini-sdk' || apiMode === 'openai-official') return apiMode
  return undefined
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

async function syncResolvedOutput(input: {
  current: string
  resolved: PromiseLike<string | undefined> | string | undefined
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  seq: number
  kind: 'text' | 'reasoning'
  lane: 'main' | 'reasoning'
}): Promise<{ value: string; seq: number }> {
  try {
    const resolvedValue = await Promise.resolve(input.resolved).catch(() => undefined)
    if (!resolvedValue || resolvedValue === input.current) {
      return { value: input.current, seq: input.seq }
    }
    const delta = resolvedValue.startsWith(input.current)
      ? resolvedValue.slice(input.current.length)
      : resolvedValue
    return {
      value: resolvedValue,
      seq: emitDelta({
        callbacks: input.callbacks,
        streamStep: input.streamStep,
        kind: input.kind,
        delta,
        seq: input.seq,
        lane: input.lane,
      }),
    }
  } catch {
    return { value: input.current, seq: input.seq }
  }
}

async function readAiSdkWarnings(result: AiSdkStreamResult): Promise<unknown[]> {
  try {
    const warnings = await Promise.resolve(result.warnings).catch(() => null)
    return Array.isArray(warnings) ? warnings : []
  } catch {
    return []
  }
}

async function readAiSdkFinishReason(result: AiSdkStreamResult): Promise<string | undefined> {
  try {
    const finishReason = await Promise.resolve(result.finishReason).catch(() => undefined)
    return typeof finishReason === 'string' && finishReason ? finishReason : undefined
  } catch {
    return undefined
  }
}

async function readAiSdkProviderMetadata(result: AiSdkStreamResult): Promise<unknown> {
  try {
    return await Promise.resolve(
      (result as unknown as { experimental_providerMetadata?: unknown }).experimental_providerMetadata,
    ).catch(() => undefined)
  } catch {
    return undefined
  }
}

async function readAiSdkResponseInfo(result: AiSdkStreamResult): Promise<{
  sdkResponseStatus?: number
  sdkResponseHeaders?: Record<string, string>
}> {
  try {
    const response = await Promise.resolve(result.response).catch(() => null)
    if (!response) return {}
    const status = (response as { status?: number }).status
    const headers = (response as { headers?: Record<string, string> }).headers
    if (!headers || typeof headers !== 'object') {
      return { sdkResponseStatus: status }
    }
    return {
      sdkResponseStatus: status,
      sdkResponseHeaders: Object.fromEntries(
        Object.entries(headers).filter(([key]) => RESPONSE_HEADER_ALLOWLIST.has(key)),
      ) as Record<string, string>,
    }
  } catch {
    return {}
  }
}
