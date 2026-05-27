import { Prisma } from '@prisma/client'
import { ApiError } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'
import { validateWorkflowCanvasDefinition } from './canvas-validation'
import {
  toWorkflowDefinitionDetail,
  toWorkflowDefinitionSummary,
  toWorkflowDefinitionVersionDetail,
} from './definition-store-mappers'
import type {
  SaveDraftParams,
  StoreParams,
  WorkflowDefinitionDb,
  WorkflowDefinitionDetail,
  WorkflowDefinitionSummary,
  WorkflowDefinitionVersionDetail,
  WorkflowTypeParams,
} from './definition-store-types'
import {
  ensurePublishable,
  ensureWorkflowType,
  normalizeDraftDefinition,
} from './definition-store-validation'

function storeDb(db: WorkflowDefinitionDb | undefined): WorkflowDefinitionDb {
  return (db || prisma) as unknown as WorkflowDefinitionDb
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export async function listProjectWorkflowDefinitions(params: StoreParams): Promise<WorkflowDefinitionSummary[]> {
  const rows = await storeDb(params.db).workflowDefinition.findMany({
    where: { projectId: params.projectId, userId: params.userId },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(toWorkflowDefinitionSummary)
}

export async function getProjectWorkflowDefinition(params: WorkflowTypeParams): Promise<WorkflowDefinitionDetail | null> {
  const row = await storeDb(params.db).workflowDefinition.findUnique({
    where: { projectId_workflowType: { projectId: params.projectId, workflowType: params.workflowType } },
  })
  if (!row || row.userId !== params.userId) return null
  return toWorkflowDefinitionDetail(row)
}

export async function getProjectPublishedWorkflowDefinitionVersion(
  params: WorkflowTypeParams,
): Promise<WorkflowDefinitionVersionDetail | null> {
  const db = storeDb(params.db)
  const row = await db.workflowDefinition.findUnique({
    where: { projectId_workflowType: { projectId: params.projectId, workflowType: params.workflowType } },
  })
  if (!row || row.userId !== params.userId || !row.publishedVersionId) return null
  const version = await db.workflowDefinitionVersion.findUnique({
    where: { id: row.publishedVersionId },
  })
  if (
    !version
    || version.workflowDefinitionId !== row.id
    || version.projectId !== params.projectId
    || version.userId !== params.userId
    || version.workflowType !== params.workflowType
  ) {
    return null
  }
  return toWorkflowDefinitionVersionDetail(version)
}

export async function saveProjectWorkflowDefinitionDraft(params: SaveDraftParams): Promise<WorkflowDefinitionDetail> {
  const definition = normalizeDraftDefinition(params.definition)
  ensureWorkflowType(params.workflowType, definition)
  const validation = validateWorkflowCanvasDefinition(definition)
  const row = await storeDb(params.db).$transaction(async (tx) => {
    const existing = await tx.workflowDefinition.findUnique({
      where: { projectId_workflowType: { projectId: params.projectId, workflowType: definition.workflowType } },
    })
    if (existing) {
      if (existing.userId !== params.userId) throw new ApiError('NOT_FOUND')
      return await tx.workflowDefinition.update({
        where: { id: existing.id },
        data: {
          title: definition.title,
          draftDefinition: toJson(definition),
          draftValidation: toJson(validation),
        },
      })
    }
    return await tx.workflowDefinition.create({
      data: {
        projectId: params.projectId,
        userId: params.userId,
        workflowType: definition.workflowType,
        title: definition.title,
        draftDefinition: toJson(definition),
        draftValidation: toJson(validation),
      },
    })
  })
  return toWorkflowDefinitionDetail(row)
}

export async function publishProjectWorkflowDefinition(
  params: WorkflowTypeParams,
): Promise<{ definition: WorkflowDefinitionDetail; version: WorkflowDefinitionVersionDetail }> {
  const db = storeDb(params.db)
  try {
    return await db.$transaction(async (tx) => {
      const row = await tx.workflowDefinition.findUnique({
        where: { projectId_workflowType: { projectId: params.projectId, workflowType: params.workflowType } },
      })
      if (!row || row.userId !== params.userId) throw new ApiError('NOT_FOUND')
      const definition = ensurePublishable(row)
      const validation = validateWorkflowCanvasDefinition(definition)
      const nextVersion = (row.publishedVersion || 0) + 1
      const version = await tx.workflowDefinitionVersion.create({
        data: {
          workflowDefinitionId: row.id,
          projectId: row.projectId,
          userId: params.userId,
          workflowType: row.workflowType,
          title: definition.title,
          version: nextVersion,
          definition: toJson(definition),
          validation: toJson(validation),
        },
      })
      const updated = await tx.workflowDefinition.update({
        where: { id: row.id },
        data: {
          title: definition.title,
          publishedVersion: nextVersion,
          publishedVersionId: version.id,
        },
      })
      return {
        definition: toWorkflowDefinitionDetail(updated),
        version: toWorkflowDefinitionVersionDetail(version),
      }
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ApiError('CONFLICT', {
        code: 'WORKFLOW_DEFINITION_VERSION_CONFLICT',
        message: 'workflow definition was published concurrently',
      })
    }
    throw error
  }
}
