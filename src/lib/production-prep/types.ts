import type {
  ProductionPrepDocument,
  ProductionPrepValidationIssue,
  ProductionSourceMode,
} from '@/lib/production-bible'

export type ProductionPrepLockSection =
  | 'characters'
  | 'locations'
  | 'props'
  | 'style'
  | 'continuity'

export type ProductionPrepLockConflict = Readonly<{
  section: ProductionPrepLockSection
  path: string
  id?: string
  name?: string
  message: string
}>

export type ProjectProductionPrepDetail = Readonly<{
  id: string | null
  projectId: string
  userId: string
  document: ProductionPrepDocument
  version: number
  sourceMode: ProductionSourceMode
  lastGeneratedSource: Record<string, unknown> | null
  createdAt: string | null
  updatedAt: string | null
  validation: {
    valid: boolean
    issues: readonly ProductionPrepValidationIssue[]
  }
}>

export type ProductionPrepMutationResult = Readonly<{
  productionPrep: ProjectProductionPrepDetail
  conflicts: readonly ProductionPrepLockConflict[]
}>

export type ProductionPrepGeneratedMeta = Readonly<{
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}>

export type ProductionPrepGenerationResult = ProductionPrepMutationResult & Readonly<{
  generated: ProductionPrepGeneratedMeta
}>
