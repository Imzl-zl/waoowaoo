import { Prisma, type ProjectProductionPrep } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  createEmptyProductionPrepDocument,
  validateProductionPrepDocument,
  type ProductionPrepDocument,
  type ProductionSourceMode,
} from '@/lib/production-bible'
import type { ProjectProductionPrepDetail } from './types'

export type ProductionPrepStoreDb = typeof prisma

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function toJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

export function createInitialProductionPrepDetail(params: {
  projectId: string
  userId: string
  projectName: string
  language?: string
}): ProjectProductionPrepDetail {
  const document = createEmptyProductionPrepDocument({
    title: params.projectName || 'Production Bible',
    sourceMode: 'manual',
    language: params.language,
  })
  const validation = validateProductionPrepDocument(document)
  return {
    id: null,
    projectId: params.projectId,
    userId: params.userId,
    document,
    version: 0,
    sourceMode: document.sourceMode,
    lastGeneratedSource: null,
    createdAt: null,
    updatedAt: null,
    validation: {
      valid: validation.valid,
      issues: validation.issues,
    },
  }
}

export function mapProductionPrepRow(row: ProjectProductionPrep): ProjectProductionPrepDetail {
  const validation = validateProductionPrepDocument(row.document)
  const document = validation.document as ProductionPrepDocument
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    document,
    version: row.version,
    sourceMode: document.sourceMode,
    lastGeneratedSource: toJsonObject(row.lastGeneratedSource),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    validation: {
      valid: validation.valid,
      issues: validation.issues,
    },
  }
}

export async function findProductionPrepRow(params: {
  projectId: string
  db?: ProductionPrepStoreDb
}): Promise<ProjectProductionPrep | null> {
  const db = params.db || prisma
  return await db.projectProductionPrep.findUnique({
    where: { projectId: params.projectId },
  })
}

export async function upsertProductionPrepRow(params: {
  projectId: string
  userId: string
  document: ProductionPrepDocument
  sourceMode?: ProductionSourceMode
  lastGeneratedSource?: Record<string, unknown> | null
  db?: ProductionPrepStoreDb
}): Promise<ProjectProductionPrepDetail> {
  const db = params.db || prisma
  const row = await db.$transaction(async (tx) => {
    const existing = await tx.projectProductionPrep.findUnique({
      where: { projectId: params.projectId },
    })
    if (!existing) {
      return await tx.projectProductionPrep.create({
        data: {
          projectId: params.projectId,
          userId: params.userId,
          document: toJson(params.document),
          sourceMode: params.sourceMode || params.document.sourceMode,
          lastGeneratedSource: params.lastGeneratedSource === undefined
            ? undefined
            : toJson(params.lastGeneratedSource),
        },
      })
    }
    return await tx.projectProductionPrep.update({
      where: { id: existing.id },
      data: {
        userId: params.userId,
        document: toJson(params.document),
        version: existing.version + 1,
        sourceMode: params.sourceMode || params.document.sourceMode,
        ...(params.lastGeneratedSource === undefined
          ? {}
          : { lastGeneratedSource: toJson(params.lastGeneratedSource) }),
      },
    })
  })
  return mapProductionPrepRow(row)
}
