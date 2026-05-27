import type { z } from 'zod'
import type {
  characterCardSchema,
  continuityRulesSchema,
  episodePlanSchema,
  locationCardSchema,
  productionAssetCardsSchema,
  productionBibleSchema,
  productionPrepSectionSchema,
  productionReviewStateSchema,
  productionSourceModeSchema,
  propCardSchema,
  sceneBreakdownSchema,
  shotPlanSchema,
  styleBibleSchema,
} from './schema'
import type { productionPrepDocumentSchema } from './document-schema'

export type ProductionSourceMode = z.infer<typeof productionSourceModeSchema>
export type ProductionPrepSection = z.infer<typeof productionPrepSectionSchema>
export type ProductionPrepDocument = z.infer<typeof productionPrepDocumentSchema>
export type ProductionBible = z.infer<typeof productionBibleSchema>
export type ProductionAssetCards = z.infer<typeof productionAssetCardsSchema>
export type CharacterCard = z.infer<typeof characterCardSchema>
export type LocationCard = z.infer<typeof locationCardSchema>
export type PropCard = z.infer<typeof propCardSchema>
export type StyleBible = z.infer<typeof styleBibleSchema>
export type EpisodePlan = z.infer<typeof episodePlanSchema>
export type SceneBreakdown = z.infer<typeof sceneBreakdownSchema>
export type ShotPlan = z.infer<typeof shotPlanSchema>
export type ContinuityRules = z.infer<typeof continuityRulesSchema>
export type ProductionReviewState = z.infer<typeof productionReviewStateSchema>
