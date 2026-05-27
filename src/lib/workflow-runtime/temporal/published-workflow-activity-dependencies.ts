import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalWorkflowRunInput,
} from './types'

export type CreatePublishedWorkflowArtifact = (params: {
  runId: string
  stepKey?: string | null
  artifactType: string
  refId: string
  versionHash?: string | null
  payload?: Record<string, unknown> | null
}) => Promise<unknown>

export type ListPublishedWorkflowArtifacts = (params: {
  runId: string
  stepKey?: string
  artifactType?: string
  refId?: string
  limit?: number
}) => Promise<Array<{
  id: string
  runId: string
  stepKey: string | null
  artifactType: string
  refId: string
  versionHash: string | null
  payload: unknown
  createdAt: string
}>>

export type PublishedWorkflowLlmMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type PublishedWorkflowLlmStepResult = {
  text: string
  reasoning: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export type ResolvePublishedWorkflowLlmModel = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
}) => Promise<string>

export type ExecutePublishedWorkflowLlmText = (input: {
  userId: string
  model: string
  messages: PublishedWorkflowLlmMessage[]
  projectId?: string
  action: string
  meta: {
    stepId: string
    stepAttempt: number
    stepTitle: string
    stepIndex: number
    stepTotal: number
  }
  temperature?: number
  reasoning?: boolean
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
}) => Promise<PublishedWorkflowLlmStepResult>

export type BillPublishedWorkflowLlmText = <T>(params: {
  userId: string
  model: string
  maxInputTokens: number
  maxOutputTokens: number
  projectId: string
  action: string
  billingKey: string
  metadata: Record<string, unknown>
  execute: () => Promise<T>
}) => Promise<T>

export type PublishedWorkflowLlmDependencies = Readonly<{
  resolveModel?: ResolvePublishedWorkflowLlmModel
  executeText?: ExecutePublishedWorkflowLlmText
  billText?: BillPublishedWorkflowLlmText
}>

export type PublishedWorkflowImageModelSlot =
  | 'storyboardModel'
  | 'characterModel'
  | 'locationModel'
  | 'editModel'

export type PublishedWorkflowImageModelSelection = Readonly<{
  model: string
  modelSlot: PublishedWorkflowImageModelSlot
}>

export type PublishedWorkflowImageGenerationOptions = Readonly<Record<string, string | number | boolean | string[]>>
export type PublishedWorkflowVideoGenerationOptions = Readonly<Record<string, string | number | boolean>>
export type PublishedWorkflowAudioGenerationOptions = Readonly<{
  voice: string
  rate?: number
  maxFreezeSeconds: number
}>

export type PublishedWorkflowImageGenerateResult = Readonly<{
  success: boolean
  imageUrl?: string
  imageUrls?: string[]
  imageBase64?: string
  error?: string
  requestId?: string
  async?: boolean
  externalId?: string
}>

export type PublishedWorkflowVideoGenerateResult = Readonly<{
  success: boolean
  videoUrl?: string
  error?: string
  requestId?: string
  async?: boolean
  externalId?: string
}>

export type PublishedWorkflowAudioGenerateResult = Readonly<{
  success: boolean
  audioUrl?: string
  audioBase64?: string
  error?: string
  requestId?: string
  async?: boolean
  externalId?: string
  actualDurationSeconds?: number
  actualSeconds?: number
}>

export type PublishedWorkflowMediaPollResult = Readonly<{
  status: string
  resultUrl?: string
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
  error?: string
  actualVideoTokens?: number
  actualDurationSeconds?: number
  actualSeconds?: number
  downloadHeaders?: Record<string, string>
}>

export type PublishedWorkflowMediaRef = Readonly<{
  id: string
  publicId: string
  url: string
  mimeType: string | null
  sizeBytes: number | null
  width: number | null
  height: number | null
  durationMs: number | null
  sha256?: string | null
  updatedAt?: string | null
  storageKey?: string
}>

export type ResolvePublishedWorkflowImageModel = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
}) => Promise<PublishedWorkflowImageModelSelection>

export type PublishedWorkflowVideoModelSelection = Readonly<{
  model: string
  modelSlot: 'videoModel'
}>

export type PublishedWorkflowAudioModelSelection = Readonly<{
  model: string
  modelSlot: 'audioModel'
}>

export type ResolvePublishedWorkflowImageOptions = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  model: string
}) => Promise<PublishedWorkflowImageGenerationOptions>

export type GeneratePublishedWorkflowImage = (params: {
  userId: string
  model: string
  prompt: string
  options: PublishedWorkflowImageGenerationOptions
}) => Promise<PublishedWorkflowImageGenerateResult>

export type ResolvePublishedWorkflowVideoModel = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
}) => Promise<PublishedWorkflowVideoModelSelection>

export type ResolvePublishedWorkflowVideoOptions = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  model: string
}) => Promise<PublishedWorkflowVideoGenerationOptions>

export type ResolvePublishedWorkflowVideoSourceImage = (params: {
  step: TemporalPublishedWorkflowStep
  context: TemporalPublishedWorkflowStepContext
}) => Promise<{
  imageUrl: string
  sourceStepKey: string
  storageKey?: string | null
}>

export type GeneratePublishedWorkflowVideo = (params: {
  userId: string
  model: string
  prompt: string
  imageUrl: string
  options: PublishedWorkflowVideoGenerationOptions
}) => Promise<PublishedWorkflowVideoGenerateResult>

export type ResolvePublishedWorkflowAudioModel = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
}) => Promise<PublishedWorkflowAudioModelSelection>

export type ResolvePublishedWorkflowAudioOptions = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  model: string
  renderedText: string
}) => Promise<PublishedWorkflowAudioGenerationOptions>

export type GeneratePublishedWorkflowAudio = (params: {
  userId: string
  model: string
  text: string
  options: PublishedWorkflowAudioGenerationOptions
}) => Promise<PublishedWorkflowAudioGenerateResult>

export type PollPublishedWorkflowMediaExternalJob = (params: {
  userId: string
  externalId: string
}) => Promise<PublishedWorkflowMediaPollResult>

export type BillPublishedWorkflowImage = <T>(params: {
  userId: string
  model: string
  count: number
  projectId: string
  action: string
  billingKey: string
  metadata: Record<string, unknown>
  execute: () => Promise<T>
}) => Promise<T>

export type BillPublishedWorkflowVideo = <T>(params: {
  userId: string
  model: string
  resolution: string
  maxCount: number
  projectId: string
  action: string
  billingKey: string
  metadata: Record<string, unknown>
  execute: () => Promise<T>
}) => Promise<T>

export type BillPublishedWorkflowAudio = <T>(params: {
  userId: string
  model: string
  maxFreezeSeconds: number
  projectId: string
  action: string
  billingKey: string
  metadata: Record<string, unknown>
  execute: () => Promise<T>
}) => Promise<T>

export type StorePublishedWorkflowImage = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  source: string
}) => Promise<{
  storageKey: string
  mediaRef: PublishedWorkflowMediaRef
}>

export type StorePublishedWorkflowVideo = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  source: string
  downloadHeaders?: Record<string, string>
}) => Promise<{
  storageKey: string
  mediaRef: PublishedWorkflowMediaRef
}>

export type StorePublishedWorkflowAudio = (params: {
  workflow: TemporalWorkflowRunInput
  step: TemporalPublishedWorkflowStep
  source: string
  downloadHeaders?: Record<string, string>
}) => Promise<{
  storageKey: string
  mediaRef: PublishedWorkflowMediaRef
}>

export type PublishedWorkflowMediaDependencies = Readonly<{
  resolveImageModel?: ResolvePublishedWorkflowImageModel
  resolveImageOptions?: ResolvePublishedWorkflowImageOptions
  generateImage?: GeneratePublishedWorkflowImage
  pollExternalJob?: PollPublishedWorkflowMediaExternalJob
  billImage?: BillPublishedWorkflowImage
  storeImage?: StorePublishedWorkflowImage
  resolveVideoModel?: ResolvePublishedWorkflowVideoModel
  resolveVideoOptions?: ResolvePublishedWorkflowVideoOptions
  resolveVideoSourceImage?: ResolvePublishedWorkflowVideoSourceImage
  generateVideo?: GeneratePublishedWorkflowVideo
  billVideo?: BillPublishedWorkflowVideo
  storeVideo?: StorePublishedWorkflowVideo
  resolveAudioModel?: ResolvePublishedWorkflowAudioModel
  resolveAudioOptions?: ResolvePublishedWorkflowAudioOptions
  generateAudio?: GeneratePublishedWorkflowAudio
  billAudio?: BillPublishedWorkflowAudio
  storeAudio?: StorePublishedWorkflowAudio
}>
