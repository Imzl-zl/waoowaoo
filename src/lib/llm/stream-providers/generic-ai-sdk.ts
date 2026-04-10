import OpenAI from 'openai'
import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { finalizeGeneratedStreamResult } from '../chat-stream-shared'
import type { ChatCompletionStreamCallbacks, ChatMessage } from '../types'
import {
  type StreamStepMeta,
  buildAiSdkProviderOptions,
  buildAiSdkStreamParams,
  collectAiSdkMetadata,
  normalizeUsage,
  readAiSdkUsage,
  resolveAiSdkFinalState,
  runAiSdkFallbackWithoutReasoningOptions,
  streamAiSdkChunks,
  throwEmptyAiSdkResponse,
} from './generic-ai-sdk-helpers'

export async function runGenericAiSdkStreamAdapter(input: {
  providerKey: string
  providerName: string
  providerApiMode?: string
  resolvedModelId: string
  modelKey: string
  messages: ChatMessage[]
  apiKey?: string
  baseUrl: string
  temperature: number
  reasoning: boolean
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high'
  maxRetries: number
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  userId: string
  projectId?: string
  action?: string
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const aiOpenAI = createOpenAI({
    baseURL: input.baseUrl,
    apiKey: input.apiKey,
    name: input.providerName,
  })
  const { aiSdkProviderOptions, isNativeOpenAIReasoning } = buildAiSdkProviderOptions({
    providerKey: input.providerKey,
    providerApiMode: input.providerApiMode,
    reasoning: input.reasoning,
    reasoningEffort: input.reasoningEffort,
    modelId: input.resolvedModelId,
  })
  const aiStreamResult = streamText(buildAiSdkStreamParams({
    aiOpenAI,
    resolvedModelId: input.resolvedModelId,
    messages: input.messages,
    temperature: input.temperature,
    reasoning: input.reasoning,
    maxRetries: input.maxRetries,
    aiSdkProviderOptions,
  }))

  const streamedState = await streamAiSdkChunks({
    result: aiStreamResult,
    callbacks: input.callbacks,
    streamStep: input.streamStep,
  })
  const metadata = await collectAiSdkMetadata(aiStreamResult)
  let finalState = await resolveAiSdkFinalState({
    result: aiStreamResult,
    state: streamedState,
    callbacks: input.callbacks,
    streamStep: input.streamStep,
  })
  let usage = await readAiSdkUsage(aiStreamResult)

  if (!finalState.text && aiSdkProviderOptions) {
    const fallbackState = await runAiSdkFallbackWithoutReasoningOptions({
      aiOpenAI,
      resolvedModelId: input.resolvedModelId,
      messages: input.messages,
      temperature: input.temperature,
      maxRetries: input.maxRetries,
      callbacks: input.callbacks,
      streamStep: input.streamStep,
      userId: input.userId,
      projectId: input.projectId,
      providerName: input.providerName,
      modelKey: input.modelKey,
      action: input.action,
      finishReason: metadata.sdkFinishReason ?? streamedState.streamFinishReason ?? 'unknown',
      state: finalState,
      usage,
    })
    finalState = fallbackState.state
    usage = fallbackState.usage
  }

  if (!finalState.text) {
    throwEmptyAiSdkResponse({
      userId: input.userId,
      projectId: input.projectId,
      providerName: input.providerName,
      resolvedModelId: input.resolvedModelId,
      modelKey: input.modelKey,
      action: input.action,
      reasoning: input.reasoning,
      reasoningEffort: input.reasoningEffort,
      isNativeOpenAIReasoning,
      state: finalState,
      diagnostics: streamedState,
      metadata,
    })
  }

  return finalizeGeneratedStreamResult({
    callbacks: input.callbacks,
    streamStep: input.streamStep,
    userId: input.userId,
    projectId: input.projectId,
    provider: input.providerName,
    modelId: input.resolvedModelId,
    modelKey: input.modelKey,
    action: input.action,
    text: finalState.text,
    reasoning: finalState.reasoning,
    usage: normalizeUsage(usage),
  })
}
