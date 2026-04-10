import OpenAI from 'openai'
import {
  runOpenAICompatChatCompletion,
  runOpenAICompatResponsesCompletion,
} from '@/lib/model-gateway'
import { finalizeCompletionFromParts } from '../chat-stream-shared'
import { emitStreamStage } from '../stream-helpers'
import type { ChatCompletionStreamCallbacks, ChatMessage } from '../types'
import type { ResolvedLlmRuntimeModel } from '../runtime-shared'

type StreamStepMeta = Parameters<typeof emitStreamStage>[1]

export async function runOpenAICompatStreamAdapter(input: {
  userId: string
  providerId: string
  providerKey: string
  selection: ResolvedLlmRuntimeModel
  resolvedModelId: string
  messages: ChatMessage[]
  temperature: number
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  projectId?: string
  action?: string
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  if (input.providerKey !== 'openai-compatible') {
    throw new Error(`OPENAI_COMPAT_PROVIDER_UNSUPPORTED: ${input.providerId}`)
  }
  if (!input.selection.llmProtocol) {
    throw new Error(`MODEL_LLM_PROTOCOL_REQUIRED: ${input.selection.modelKey}`)
  }

  const compatEngine = input.selection.llmProtocol === 'responses'
    ? 'openai_compat_responses'
    : 'openai_compat_chat_completions'
  emitStreamStage(input.callbacks, input.streamStep, 'streaming', 'openai-compat')

  const completion = input.selection.llmProtocol === 'responses'
    ? await runOpenAICompatResponsesCompletion({
      userId: input.userId,
      providerId: input.providerId,
      modelId: input.resolvedModelId,
      messages: input.messages,
      temperature: input.temperature,
    })
    : await runOpenAICompatChatCompletion({
      userId: input.userId,
      providerId: input.providerId,
      modelId: input.resolvedModelId,
      messages: input.messages,
      temperature: input.temperature,
    })

  return finalizeCompletionFromParts({
    completion,
    callbacks: input.callbacks,
    streamStep: input.streamStep,
    userId: input.userId,
    projectId: input.projectId,
    provider: compatEngine,
    modelId: input.resolvedModelId,
    modelKey: input.selection.modelKey,
    action: input.action,
  })
}

