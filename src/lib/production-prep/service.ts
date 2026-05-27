import { ApiError } from '@/lib/api-errors'
import type { ProductionPrepDocument } from '@/lib/production-bible'
import { assertValidProductionPrepDocument } from './validation'
import {
  findProductionPrepRow,
  createInitialProductionPrepDetail,
  mapProductionPrepRow,
  upsertProductionPrepRow,
  type ProductionPrepStoreDb,
} from './store'
import { normalizeProductionPrepExtractParams } from './extract-params'
import { normalizeEpisodePlanningParams } from './episode-params'
import {
  generateEpisodePlans,
  generateProductionPrepDraft,
  summarizeGeneratedSource,
  type ProductionPrepLlmDependencies,
} from './generation'
import {
  mergeGeneratedEpisodePlans,
  mergeGeneratedProductionPrepDocument,
} from './merge'
import type {
  ProjectProductionPrepDetail,
  ProductionPrepGenerationResult,
  ProductionPrepMutationResult,
} from './types'

export async function getProjectProductionPrep(params: {
  projectId: string
  userId: string
  projectName: string
  language?: string
  db?: ProductionPrepStoreDb
}): Promise<ProjectProductionPrepDetail> {
  const row = await findProductionPrepRow(params)
  if (!row) {
    return createInitialProductionPrepDetail({
      projectId: params.projectId,
      userId: params.userId,
      projectName: params.projectName,
      language: params.language,
    })
  }
  if (row.userId !== params.userId) throw new ApiError('NOT_FOUND')
  return mapProductionPrepRow(row)
}

export async function saveProjectProductionPrep(params: {
  projectId: string
  userId: string
  document: unknown
  db?: ProductionPrepStoreDb
}): Promise<ProductionPrepMutationResult> {
  const document = assertValidProductionPrepDocument(params.document)
  const productionPrep = await upsertProductionPrepRow({
    projectId: params.projectId,
    userId: params.userId,
    document,
    sourceMode: document.sourceMode,
    db: params.db,
  })
  return { productionPrep, conflicts: [] }
}

async function requireSavedProductionPrep(params: {
  projectId: string
  userId: string
  db?: ProductionPrepStoreDb
}): Promise<ProjectProductionPrepDetail> {
  const row = await findProductionPrepRow(params)
  if (!row || row.userId !== params.userId) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PRODUCTION_PREP_DOCUMENT_REQUIRED',
      message: 'production prep document must be saved before planning episodes',
    })
  }
  return mapProductionPrepRow(row)
}

function withGeneratedMetadata(params: {
  document: ProductionPrepDocument
  sourceDigest?: string
  now: string
}): ProductionPrepDocument {
  return assertValidProductionPrepDocument({
    ...params.document,
    metadata: {
      ...params.document.metadata,
      ...(params.sourceDigest ? { sourceDigest: params.sourceDigest } : {}),
      updatedAt: params.now,
    },
  })
}

export async function extractProjectProductionPrep(params: {
  projectId: string
  userId: string
  projectName: string
  body: unknown
  language?: string
  db?: ProductionPrepStoreDb
  llm?: ProductionPrepLlmDependencies
  now?: () => Date
}): Promise<ProductionPrepGenerationResult> {
  const input = normalizeProductionPrepExtractParams(params.body)
  const now = (params.now?.() || new Date()).toISOString()
  const current = await getProjectProductionPrep({
    projectId: params.projectId,
    userId: params.userId,
    projectName: params.projectName,
    language: params.language || input.language,
    db: params.db,
  })
  const generated = await generateProductionPrepDraft({
    projectId: params.projectId,
    userId: params.userId,
    input,
    deps: params.llm,
  })
  const merged = mergeGeneratedProductionPrepDocument({
    current: current.document,
    generated: withGeneratedMetadata({ document: generated.output, now }),
    now,
  })
  const document = assertValidProductionPrepDocument(merged.document)
  const source = summarizeGeneratedSource({
    operation: 'extract',
    sourceText: input.sourceText,
    sourceMode: input.sourceMode,
    at: now,
    model: generated.model,
  })
  const productionPrep = await upsertProductionPrepRow({
    projectId: params.projectId,
    userId: params.userId,
    document,
    sourceMode: document.sourceMode,
    lastGeneratedSource: source,
    db: params.db,
  })
  return {
    productionPrep,
    conflicts: merged.conflicts,
    generated: { model: generated.model, usage: generated.usage },
  }
}

export async function planProjectProductionPrepEpisodes(params: {
  projectId: string
  userId: string
  body: unknown
  db?: ProductionPrepStoreDb
  llm?: ProductionPrepLlmDependencies
  now?: () => Date
}): Promise<ProductionPrepGenerationResult> {
  const input = normalizeEpisodePlanningParams(params.body)
  const now = (params.now?.() || new Date()).toISOString()
  const current = await requireSavedProductionPrep(params)
  const generated = await generateEpisodePlans({
    projectId: params.projectId,
    userId: params.userId,
    document: current.document,
    input,
    deps: params.llm,
  })
  const document = assertValidProductionPrepDocument(mergeGeneratedEpisodePlans({
    current: current.document,
    episodePlans: [...generated.output],
    now,
  }))
  const source = summarizeGeneratedSource({
    operation: 'plan-episodes',
    at: now,
    model: generated.model,
    config: input,
  })
  const productionPrep = await upsertProductionPrepRow({
    projectId: params.projectId,
    userId: params.userId,
    document,
    sourceMode: document.sourceMode,
    lastGeneratedSource: source,
    db: params.db,
  })
  return {
    productionPrep,
    conflicts: [],
    generated: { model: generated.model, usage: generated.usage },
  }
}
