'use client'

import { useCallback, useState } from 'react'
import {
  useAssistantChat,
  type AssistantSavedEvent,
  type UseAssistantChatResult,
} from '@/components/assistant/useAssistantChat'
import type { CustomModel, Provider } from '../../types'
import { getProviderKey } from '../../types'
import { upsertModelFromAssistantDraft } from './providerCardStateHelpers'

interface UseProviderAssistantStateParams {
  provider: Provider
  allModels?: CustomModel[]
  models: CustomModel[]
  onAddModel: (model: Omit<CustomModel, 'enabled'>) => void
  onUpdateModel?: (modelKey: string, updates: Partial<CustomModel>) => void
  flushConfigBeforeProbe: () => Promise<boolean>
}

export function useProviderAssistantState(params: UseProviderAssistantStateParams): {
  assistantEnabled: boolean
  isAssistantOpen: boolean
  assistantSavedEvent: AssistantSavedEvent | null
  assistantChat: UseAssistantChatResult
  openAssistant: () => void
  closeAssistant: () => void
  handleAssistantSend: (content?: string) => Promise<void>
} {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [assistantSavedEvent, setAssistantSavedEvent] = useState<AssistantSavedEvent | null>(null)
  const assistantEnabled = getProviderKey(params.provider.id) === 'openai-compatible'

  const assistantChat = useAssistantChat({
    assistantId: 'api-config-template',
    context: { providerId: params.provider.id },
    enabled: assistantEnabled,
    onSaved: (event) => {
      setAssistantSavedEvent(event)
      if (event.draftModel) {
        upsertModelFromAssistantDraft({
          draft: event.draftModel,
          allModels: params.allModels,
          models: params.models,
          onAddModel: params.onAddModel,
          onUpdateModel: params.onUpdateModel,
        })
        return
      }
      params.onUpdateModel?.(event.savedModelKey, {
        compatMediaTemplateSource: 'ai',
      })
    },
  })

  const openAssistant = useCallback(() => {
    if (!assistantEnabled) return
    setAssistantSavedEvent(null)
    setIsAssistantOpen(true)
  }, [assistantEnabled])

  const closeAssistant = useCallback(() => {
    setIsAssistantOpen(false)
    setAssistantSavedEvent(null)
    assistantChat.clear()
  }, [assistantChat])

  const handleAssistantSend = useCallback(async (content?: string): Promise<void> => {
    if (!assistantEnabled || assistantChat.pending || assistantSavedEvent !== null) return
    const flushed = await params.flushConfigBeforeProbe()
    if (!flushed) return
    await assistantChat.send(content)
  }, [assistantChat, assistantEnabled, assistantSavedEvent, params])

  return {
    assistantEnabled,
    isAssistantOpen,
    assistantSavedEvent,
    assistantChat,
    openAssistant,
    closeAssistant,
    handleAssistantSend,
  }
}
