import { z } from 'zod'
import {
  episodePlanSchema,
  sceneBreakdownSchema,
  shotPlanSchema,
} from './schema'
import { productionPrepDocumentSchema } from './document-schema'

export const productionPrepDocumentOutputSchema = productionPrepDocumentSchema

export const episodePlanOutputSchema = z.object({
  episodePlans: z.array(episodePlanSchema),
}).strict()

export const sceneBreakdownOutputSchema = z.object({
  sceneBreakdowns: z.array(sceneBreakdownSchema),
}).strict()

export const shotPlanOutputSchema = z.object({
  shotPlans: z.array(shotPlanSchema),
}).strict()

export type ProductionNodeOutputKind =
  | 'production.prep.document'
  | 'production.episode.plan'
  | 'production.scene.breakdown'
  | 'production.shot.plan'

export function parseProductionNodeOutput(params: {
  kind: ProductionNodeOutputKind
  json: unknown
}): unknown {
  if (params.kind === 'production.prep.document') {
    return productionPrepDocumentOutputSchema.parse(params.json)
  }
  if (params.kind === 'production.episode.plan') {
    return episodePlanOutputSchema.parse(params.json)
  }
  if (params.kind === 'production.scene.breakdown') {
    return sceneBreakdownOutputSchema.parse(params.json)
  }
  return shotPlanOutputSchema.parse(params.json)
}
