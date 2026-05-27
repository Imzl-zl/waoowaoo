import {
  productionPrepDocumentSchema,
} from './document-schema'
import type { ProductionPrepDocument, ProductionSourceMode } from './types'

export type CreateProductionPrepDocumentInput = Readonly<{
  title: string
  sourceMode: ProductionSourceMode
  language?: string
  createdAt?: string
}>

export function parseProductionPrepDocument(input: unknown): ProductionPrepDocument {
  return productionPrepDocumentSchema.parse(input)
}

export function createEmptyProductionPrepDocument(
  input: CreateProductionPrepDocumentInput,
): ProductionPrepDocument {
  const createdAt = input.createdAt || new Date().toISOString()
  return parseProductionPrepDocument({
    schemaVersion: 1,
    sourceMode: input.sourceMode,
    title: input.title,
    metadata: {
      language: input.language || 'zh-CN',
      createdAt,
      updatedAt: createdAt,
    },
  })
}

export function isProductionPrepDocument(input: unknown): input is ProductionPrepDocument {
  return productionPrepDocumentSchema.safeParse(input).success
}
