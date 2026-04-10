import OpenAI from 'openai'
import { completeBailianLlm } from '@/lib/providers/bailian'
import { completeSiliconFlowLlm } from '@/lib/providers/siliconflow'
import { finalizeCompletionFromParts } from '../chat-stream-shared'
import { emitStreamStage } from '../stream-helpers'
import type { ChatCompletionStreamCallbacks, ChatMessage } from '../types'

type StreamStepMeta = Parameters<typeof emitStreamStage>[1]

export async function runOfficialStaticStreamAdapter(input: {
  providerKey: 'bailian' | 'siliconflow'
  resolvedModelId: string
  messages: ChatMessage[]
  apiKey?: string
  baseUrl?: string
  temperature: number
  callbacks?: ChatCompletionStreamCallbacks
  streamStep: StreamStepMeta
  userId: string
  projectId?: string
  modelKey: string
  action?: string
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  if (!input.apiKey) {
    throw new Error(`PROVIDER_API_KEY_MISSING: ${input.providerKey}`)
  }
  emitStreamStage(input.callbacks, input.streamStep, 'streaming', input.providerKey)

  const completion = input.providerKey === 'bailian'
    ? await completeBailianLlm({
      modelId: input.resolvedModelId,
      messages: input.messages,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      temperature: input.temperature,
    })
    : await completeSiliconFlowLlm({
      modelId: input.resolvedModelId,
      messages: input.messages,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      temperature: input.temperature,
    })

  return finalizeCompletionFromParts({
    completion,
    callbacks: input.callbacks,
    streamStep: input.streamStep,
    userId: input.userId,
    projectId: input.projectId,
    provider: input.providerKey,
    modelId: input.resolvedModelId,
    modelKey: input.modelKey,
    action: input.action,
  })
}
