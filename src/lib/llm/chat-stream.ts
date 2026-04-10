import OpenAI from 'openai'
import {
  resolveModelGatewayRoute,
} from '@/lib/model-gateway'
import {
  getProviderConfig,
  getProviderKey,
} from '../api-config'
import type { ChatCompletionOptions, ChatCompletionStreamCallbacks } from './types'
import {
  emitStreamStage,
  resolveStreamStepMeta,
} from './stream-helpers'
import {
  logLlmRawInput,
  resolveLlmRuntimeModel,
} from './runtime-shared'
import { runOpenAICompatStreamAdapter } from './stream-providers/openai-compat'
import { runOfficialStaticStreamAdapter } from './stream-providers/official-static'
import { runGoogleStreamAdapter } from './stream-providers/google'
import { runArkStreamAdapter } from './stream-providers/ark'
import { runGenericAiSdkStreamAdapter } from './stream-providers/generic-ai-sdk'
import { runOpenRouterStreamAdapter } from './stream-providers/openrouter'

const OFFICIAL_ONLY_PROVIDER_KEYS = new Set(['bailian', 'siliconflow'])

export async function chatCompletionStream(
  userId: string,
  model: string | null | undefined,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  options: ChatCompletionOptions = {},
  callbacks?: ChatCompletionStreamCallbacks,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const streamStep = resolveStreamStepMeta(options)
  emitStreamStage(callbacks, streamStep, 'submit')
  if (!model) {
    const error = new Error('ANALYSIS_MODEL_NOT_CONFIGURED: 请先在设置页面配置分析模型')
    callbacks?.onError?.(error, streamStep)
    throw error
  }

  const selection = await resolveLlmRuntimeModel(userId, model)
  const resolvedModelId = selection.modelId
  const provider = selection.provider
  const providerKey = getProviderKey(provider).toLowerCase()
  const providerConfig = await getProviderConfig(userId, provider)
  const gatewayRoute = OFFICIAL_ONLY_PROVIDER_KEYS.has(providerKey)
    ? 'official'
    : (providerConfig.gatewayRoute || resolveModelGatewayRoute(provider))
  const temperature = options.temperature ?? 0.7
  const reasoning = options.reasoning ?? true
  const reasoningEffort = options.reasoningEffort || 'high'
  const projectId =
    typeof options.projectId === 'string' && options.projectId.trim().length > 0
      ? options.projectId.trim()
      : undefined
  logLlmRawInput({
    userId,
    projectId,
    provider: providerKey,
    modelId: resolvedModelId,
    modelKey: selection.modelKey,
    stream: true,
    reasoning,
    reasoningEffort,
    temperature,
    action: options.action,
    messages,
  })

  try {
    if (gatewayRoute === 'openai-compat') {
      return await runOpenAICompatStreamAdapter({
        userId,
        providerId: provider,
        providerKey,
        selection,
        resolvedModelId,
        messages,
        temperature,
        callbacks,
        streamStep,
        projectId,
        action: options.action,
      })
    }

    if (providerKey === 'google' || providerKey === 'gemini-compatible') {
      return await runGoogleStreamAdapter({
        providerKey,
        providerName: provider,
        providerId: provider,
        resolvedModelId,
        modelKey: selection.modelKey,
        messages,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        temperature,
        reasoning,
        reasoningEffort,
        callbacks,
        streamStep,
        userId,
        projectId,
        action: options.action,
      })
    }

    if (providerKey === 'bailian') {
      return await runOfficialStaticStreamAdapter({
        providerKey: 'bailian',
        resolvedModelId,
        messages,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        temperature,
        callbacks,
        streamStep,
        userId,
        projectId,
        modelKey: selection.modelKey,
        action: options.action,
      })
    }

    if (providerKey === 'siliconflow') {
      return await runOfficialStaticStreamAdapter({
        providerKey: 'siliconflow',
        resolvedModelId,
        messages,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        temperature,
        callbacks,
        streamStep,
        userId,
        projectId,
        modelKey: selection.modelKey,
        action: options.action,
      })
    }


    if (providerKey === 'ark') {
      return await runArkStreamAdapter({
        providerId: provider,
        resolvedModelId,
        modelKey: selection.modelKey,
        messages,
        apiKey: providerConfig.apiKey,
        temperature,
        reasoning,
        callbacks,
        streamStep,
        userId,
        projectId,
        action: options.action,
      })
    }

    if (!providerConfig.baseUrl) {
      throw new Error(`PROVIDER_BASE_URL_MISSING: ${provider} (llm)`)
    }

    if (providerConfig.baseUrl.includes('openrouter')) {
      return await runOpenRouterStreamAdapter({
        resolvedModelId,
        modelKey: selection.modelKey,
        messages,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        temperature,
        reasoning,
        reasoningEffort,
        callbacks,
        streamStep,
        userId,
        projectId,
        action: options.action,
      })
    }

    return await runGenericAiSdkStreamAdapter({
      providerKey,
      providerName: provider,
      providerApiMode: providerConfig.apiMode,
      resolvedModelId,
      modelKey: selection.modelKey,
      messages,
      apiKey: providerConfig.apiKey,
      baseUrl: providerConfig.baseUrl,
      temperature,
      reasoning,
      reasoningEffort,
      maxRetries: options.maxRetries ?? 2,
      callbacks,
      streamStep,
      userId,
      projectId,
      action: options.action,
    })
  } catch (error) {
    // Detect PROHIBITED_CONTENT from Gemini and normalize to SENSITIVE_CONTENT
    // (consistent with chat-completion.ts)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('PROHIBITED_CONTENT') || errMsg.includes('request_body_blocked')) {
      const sensitiveError = new Error('SENSITIVE_CONTENT: 内容包含敏感信息,无法处理。请修改内容后重试')
      callbacks?.onError?.(sensitiveError, streamStep)
      throw sensitiveError
    }
    callbacks?.onError?.(error, streamStep)
    throw error
  }
}
