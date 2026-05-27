import { z } from 'zod'
import {
  PRODUCTION_PREP_SCHEMA_VERSION,
  continuityRulesSchema,
  episodePlanSchema,
  productionAssetCardsSchema,
  productionBibleSchema,
  productionPrepMetadataSchema,
  productionReviewStateSchema,
  productionSourceModeSchema,
  sceneBreakdownSchema,
  shotPlanSchema,
} from './schema'

export const productionPrepDocumentSchema = z.object({
  schemaVersion: z.literal(PRODUCTION_PREP_SCHEMA_VERSION),
  sourceMode: productionSourceModeSchema,
  title: z.string().trim().min(1),
  bible: productionBibleSchema.default({}),
  assets: productionAssetCardsSchema.default({}),
  episodePlans: z.array(episodePlanSchema).default([]),
  sceneBreakdowns: z.array(sceneBreakdownSchema).default([]),
  shotPlans: z.array(shotPlanSchema).default([]),
  continuity: continuityRulesSchema.default({}),
  review: productionReviewStateSchema.default({}),
  metadata: productionPrepMetadataSchema.default({}),
}).strict()
