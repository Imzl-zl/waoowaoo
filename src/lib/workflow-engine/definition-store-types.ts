import type { WorkflowCanvasDefinition, WorkflowCanvasValidationResult } from './canvas-types'

export type WorkflowDefinitionRow = {
  id: string
  projectId: string
  userId: string
  workflowType: string
  title: string
  draftDefinition: unknown
  draftValidation: unknown
  publishedVersion: number | null
  publishedVersionId: string | null
  createdAt: Date
  updatedAt: Date
}

export type WorkflowDefinitionVersionRow = {
  id: string
  workflowDefinitionId: string
  projectId: string
  userId: string
  workflowType: string
  title: string
  version: number
  definition: unknown
  validation: unknown
  createdAt: Date
}

type WorkflowDefinitionWhere =
  | { id: string }
  | { projectId_workflowType: { projectId: string; workflowType: string } }

type WorkflowDefinitionVersionWhere = { id: string }

type WorkflowDefinitionCreateData = Omit<
  WorkflowDefinitionRow,
  'id' | 'publishedVersion' | 'publishedVersionId' | 'createdAt' | 'updatedAt'
>

type WorkflowDefinitionUpdateData = Partial<
  Pick<
    WorkflowDefinitionRow,
    'title' | 'draftDefinition' | 'draftValidation' | 'publishedVersion' | 'publishedVersionId'
  >
>

type WorkflowDefinitionVersionCreateData = Omit<WorkflowDefinitionVersionRow, 'id' | 'createdAt'>

export type WorkflowDefinitionTx = {
  workflowDefinition: {
    create: (params: { data: WorkflowDefinitionCreateData }) => Promise<WorkflowDefinitionRow>
    findUnique: (params: { where: WorkflowDefinitionWhere }) => Promise<WorkflowDefinitionRow | null>
    update: (params: { where: { id: string }; data: WorkflowDefinitionUpdateData }) => Promise<WorkflowDefinitionRow>
  }
  workflowDefinitionVersion: {
    create: (params: { data: WorkflowDefinitionVersionCreateData }) => Promise<WorkflowDefinitionVersionRow>
    findUnique: (params: { where: WorkflowDefinitionVersionWhere }) => Promise<WorkflowDefinitionVersionRow | null>
  }
}

export type WorkflowDefinitionDb = WorkflowDefinitionTx & {
  workflowDefinition: WorkflowDefinitionTx['workflowDefinition'] & {
    findMany: (params: {
      where: { projectId: string; userId: string }
      orderBy: { updatedAt: 'desc' }
    }) => Promise<WorkflowDefinitionRow[]>
  }
  $transaction: <T>(fn: (tx: WorkflowDefinitionTx) => Promise<T>) => Promise<T>
}

export type WorkflowDefinitionSummary = Omit<WorkflowDefinitionRow, 'draftDefinition' | 'draftValidation'> & {
  draftValidation: WorkflowCanvasValidationResult
}

export type WorkflowDefinitionDetail = WorkflowDefinitionSummary & {
  draftDefinition: WorkflowCanvasDefinition
}

export type WorkflowDefinitionVersionDetail = Omit<WorkflowDefinitionVersionRow, 'definition' | 'validation'> & {
  definition: WorkflowCanvasDefinition
  validation: WorkflowCanvasValidationResult
}

export type StoreParams = {
  db?: WorkflowDefinitionDb
  projectId: string
  userId: string
}

export type SaveDraftParams = StoreParams & {
  definition: unknown
  workflowType?: string
}

export type WorkflowTypeParams = StoreParams & {
  workflowType: string
}
