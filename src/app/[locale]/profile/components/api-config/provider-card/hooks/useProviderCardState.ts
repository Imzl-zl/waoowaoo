'use client'

import { useCallback, useState } from 'react'
import {
  encodeModelKey,
  getProviderTutorial,
  type CustomModel,
} from '../../types'
import type {
  ModelFormState,
  ProviderCardGroupedModels,
  ProviderCardModelType,
  ProviderCardProps,
  ProviderCardTranslator,
} from '../types'
import type {
  AssistantSavedEvent,
  UseAssistantChatResult,
} from '@/components/assistant/useAssistantChat'
import {
  buildCustomPricingFromModelForm,
  buildMaskedKey,
  EMPTY_MODEL_FORM,
  getAssistantSavedModelLabel,
  getProviderCardMeta,
  groupModelsByType,
  isDefaultProviderModel,
  isPresetModelKey,
  probeModelLlmProtocolViaApi,
  resolveProviderProbeFailureMessage,
  shouldProbeModelLlmProtocol,
  shouldReprobeModelLlmProtocol,
  type KeyTestStatus,
  type KeyTestStep,
} from './providerCardStateHelpers'
import { useProviderConnectionTest } from './useProviderConnectionTest'
import { useProviderAssistantState } from './useProviderAssistantState'

interface UseProviderCardStateParams {
  provider: ProviderCardProps['provider']
  models: ProviderCardProps['models']
  allModels?: ProviderCardProps['allModels']
  defaultModels: ProviderCardProps['defaultModels']
  onUpdateApiKey: ProviderCardProps['onUpdateApiKey']
  onUpdateBaseUrl: ProviderCardProps['onUpdateBaseUrl']
  onUpdateModel: ProviderCardProps['onUpdateModel']
  onAddModel: ProviderCardProps['onAddModel']
  onFlushConfig: ProviderCardProps['onFlushConfig']
  t: ProviderCardTranslator
}

export interface UseProviderCardStateResult {
  providerKey: string
  isPresetProvider: boolean
  showBaseUrlEdit: boolean
  tutorial: ReturnType<typeof getProviderTutorial>
  groupedModels: ProviderCardGroupedModels
  hasModels: boolean
  isEditing: boolean
  isEditingUrl: boolean
  showKey: boolean
  tempKey: string
  tempUrl: string
  showTutorial: boolean
  showAddForm: ProviderCardModelType | null
  newModel: ModelFormState
  batchMode: boolean
  editingModelId: string | null
  editModel: ModelFormState
  maskedKey: string
  isPresetModel: (modelKey: string) => boolean
  isDefaultModel: (model: CustomModel) => boolean
  setShowKey: (value: boolean) => void
  setShowTutorial: (value: boolean) => void
  setShowAddForm: (value: ProviderCardModelType | null) => void
  setBatchMode: (value: boolean) => void
  setNewModel: (value: ModelFormState) => void
  setEditModel: (value: ModelFormState) => void
  setTempKey: (value: string) => void
  setTempUrl: (value: string) => void
  startEditKey: () => void
  startEditUrl: () => void
  handleSaveKey: () => void
  handleCancelEdit: () => void
  handleSaveUrl: () => void
  handleCancelUrlEdit: () => void
  handleEditModel: (model: CustomModel) => void
  handleCancelEditModel: () => void
  handleSaveModel: (originalModelKey: string) => Promise<void>
  handleAddModel: (type: ProviderCardModelType) => Promise<void>
  handleCancelAdd: () => void
  needsCustomPricing: boolean
  keyTestStatus: KeyTestStatus
  keyTestSteps: KeyTestStep[]
  handleForceSaveKey: () => void
  handleTestOnly: () => void | Promise<void>
  handleDismissTest: () => void
  isModelSavePending: boolean
  assistantEnabled: boolean
  isAssistantOpen: boolean
  assistantSavedEvent: AssistantSavedEvent | null
  assistantChat: UseAssistantChatResult
  openAssistant: () => void
  closeAssistant: () => void
  handleAssistantSend: (content?: string) => Promise<void>
}

export {
  buildCustomPricingFromModelForm,
  buildProviderConnectionPayload,
  getAssistantSavedModelLabel,
  probeModelLlmProtocolViaApi,
  shouldProbeModelLlmProtocol,
  shouldReprobeModelLlmProtocol,
} from './providerCardStateHelpers'

export function useProviderCardState({
  provider,
  models,
  allModels,
  defaultModels,
  onUpdateApiKey,
  onUpdateBaseUrl,
  onUpdateModel,
  onAddModel,
  onFlushConfig,
  t,
}: UseProviderCardStateParams): UseProviderCardStateResult {
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [tempKey, setTempKey] = useState(provider.apiKey || '')
  const [tempUrl, setTempUrl] = useState(provider.baseUrl || '')
  const [showTutorial, setShowTutorial] = useState(false)
  const [showAddForm, setShowAddForm] = useState<ProviderCardModelType | null>(null)
  const [newModel, setNewModel] = useState<ModelFormState>(EMPTY_MODEL_FORM)
  const [batchMode, setBatchMode] = useState(false)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [editModel, setEditModel] = useState<ModelFormState>(EMPTY_MODEL_FORM)
  const [isModelSavePending, setIsModelSavePending] = useState(false)

  const { providerKey, isPresetProvider, showBaseUrlEdit, tutorial } = getProviderCardMeta({
    providerId: provider.id,
    onUpdateBaseUrl,
  })
  const groupedModels = groupModelsByType(models)
  const hasModels = Object.keys(groupedModels).length > 0
  const isPresetModel = isPresetModelKey
  const isDefaultModel = (model: CustomModel) => isDefaultProviderModel(model, defaultModels)

  const startEditKey = () => {
    setTempKey(provider.apiKey || '')
    setIsEditing(true)
  }

  const startEditUrl = () => {
    setTempUrl(provider.baseUrl || '')
    setIsEditingUrl(true)
  }

  const doSaveKey = useCallback(() => {
    onUpdateApiKey(provider.id, tempKey)
    setIsEditing(false)
  }, [onUpdateApiKey, provider.id, tempKey])

  const flushConfigBeforeProbe = useCallback(async (): Promise<boolean> => {
    if (!onFlushConfig) return true
    try {
      await onFlushConfig()
      return true
    } catch {
      alert(t('flushConfigFailed'))
      return false
    }
  }, [onFlushConfig, t])

  const connectionTest = useProviderConnectionTest({
    provider,
    providerKey,
    models,
    defaultAnalysisModel: defaultModels.analysisModel,
    tempKey,
    onPersistKey: doSaveKey,
  })

  const handleCancelEdit = () => {
    setTempKey(provider.apiKey || '')
    setIsEditing(false)
    connectionTest.resetKeyTest()
  }

  const handleSaveUrl = () => {
    onUpdateBaseUrl?.(provider.id, tempUrl)
    setIsEditingUrl(false)
  }

  const handleCancelUrlEdit = () => {
    setTempUrl(provider.baseUrl || '')
    setIsEditingUrl(false)
  }

  const handleEditModel = (model: CustomModel) => {
    setEditingModelId(model.modelKey)
    setEditModel({
      name: model.name,
      modelId: model.modelId,
    })
  }

  const handleCancelEditModel = () => {
    setEditingModelId(null)
    setEditModel(EMPTY_MODEL_FORM)
  }

  const handleSaveModel = async (originalModelKey: string): Promise<void> => {
    if (isModelSavePending) return
    if (!editModel.name || !editModel.modelId) {
      alert(t('fillComplete'))
      return
    }

    const nextModelKey = encodeModelKey(provider.id, editModel.modelId)
    const all = allModels || models
    const duplicate = all.some(
      (model) => model.modelKey === nextModelKey && model.modelKey !== originalModelKey,
    )
    if (duplicate) {
      alert(t('modelIdExists'))
      return
    }

    setIsModelSavePending(true)
    try {
      const originalModel = all.find((model) => model.modelKey === originalModelKey)
      let protocolUpdates: Pick<CustomModel, 'llmProtocol' | 'llmProtocolCheckedAt'> | null = null
      if (originalModel && shouldReprobeModelLlmProtocol({
        providerId: provider.id,
        originalModel,
        nextModelId: editModel.modelId,
      })) {
        const flushed = await flushConfigBeforeProbe()
        if (!flushed) return

        try {
          protocolUpdates = await probeModelLlmProtocolViaApi({
            providerId: provider.id,
            modelId: editModel.modelId,
          })
        } catch (error) {
          alert(resolveProviderProbeFailureMessage(error, t))
          return
        }
      }

      onUpdateModel?.(originalModelKey, {
        name: editModel.name,
        modelId: editModel.modelId,
        ...(protocolUpdates ? protocolUpdates : {}),
      })
      handleCancelEditModel()
    } finally {
      setIsModelSavePending(false)
    }
  }

  const handleAddModel = async (type: ProviderCardModelType): Promise<void> => {
    if (isModelSavePending) return
    if (!newModel.name || !newModel.modelId) {
      alert(t('fillComplete'))
      return
    }

    const finalModelId =
      type === 'video' && batchMode && provider.id === 'ark'
        ? `${newModel.modelId}-batch`
        : newModel.modelId
    const finalModelKey = encodeModelKey(provider.id, finalModelId)
    const all = allModels || models
    if (all.some((model) => model.modelKey === finalModelKey)) {
      alert(t('modelIdExists'))
      return
    }

    const finalName =
      type === 'video' && batchMode && provider.id === 'ark'
        ? `${newModel.name} (Batch)`
        : newModel.name

    setIsModelSavePending(true)
    try {
      let protocolFields: Pick<CustomModel, 'llmProtocol' | 'llmProtocolCheckedAt'> | null = null
      if (shouldProbeModelLlmProtocol({ providerId: provider.id, modelType: type })) {
        const flushed = await flushConfigBeforeProbe()
        if (!flushed) return

        try {
          protocolFields = await probeModelLlmProtocolViaApi({
            providerId: provider.id,
            modelId: finalModelId,
          })
        } catch (error) {
          alert(resolveProviderProbeFailureMessage(error, t))
          return
        }
      }

      onAddModel({
        modelId: finalModelId,
        modelKey: finalModelKey,
        name: finalName,
        type,
        provider: provider.id,
        price: 0,
        ...(protocolFields ? protocolFields : {}),
      })

      setNewModel(EMPTY_MODEL_FORM)
      setBatchMode(false)
      setShowAddForm(null)
    } finally {
      setIsModelSavePending(false)
    }
  }

  const handleCancelAdd = () => {
    setShowAddForm(null)
    setNewModel(EMPTY_MODEL_FORM)
    setBatchMode(false)
  }

  const assistantState = useProviderAssistantState({
    provider,
    allModels,
    models,
    onAddModel,
    onUpdateModel,
    flushConfigBeforeProbe,
  })

  const maskedKey = buildMaskedKey(provider.apiKey)

  return {
    providerKey,
    isPresetProvider,
    showBaseUrlEdit,
    tutorial,
    groupedModels,
    hasModels,
    isEditing,
    isEditingUrl,
    showKey,
    tempKey,
    tempUrl,
    showTutorial,
    showAddForm,
    newModel,
    batchMode,
    editingModelId,
    editModel,
    maskedKey,
    isPresetModel,
    isDefaultModel,
    setShowKey,
    setShowTutorial,
    setShowAddForm,
    setBatchMode,
    setNewModel,
    setEditModel,
    setTempKey,
    setTempUrl,
    startEditKey,
    startEditUrl,
    handleSaveKey: connectionTest.handleSaveKey,
    handleCancelEdit,
    handleSaveUrl,
    handleCancelUrlEdit,
    handleEditModel,
    handleCancelEditModel,
    handleSaveModel,
    handleAddModel,
    handleCancelAdd,
    needsCustomPricing: false,
    keyTestStatus: connectionTest.keyTestStatus,
    keyTestSteps: connectionTest.keyTestSteps,
    handleForceSaveKey: connectionTest.handleForceSaveKey,
    handleTestOnly: connectionTest.handleTestOnly,
    handleDismissTest: connectionTest.handleDismissTest,
    isModelSavePending,
    assistantEnabled: assistantState.assistantEnabled,
    isAssistantOpen: assistantState.isAssistantOpen,
    assistantSavedEvent: assistantState.assistantSavedEvent,
    assistantChat: assistantState.assistantChat,
    openAssistant: assistantState.openAssistant,
    closeAssistant: assistantState.closeAssistant,
    handleAssistantSend: assistantState.handleAssistantSend,
  }
}
