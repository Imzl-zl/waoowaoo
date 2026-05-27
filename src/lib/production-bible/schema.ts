import { z } from 'zod'

export const PRODUCTION_PREP_SCHEMA_VERSION = 1

const text = z.string().trim()
const requiredText = text.min(1)
const textList = z.array(requiredText).default([])
const idText = requiredText.regex(/^[a-zA-Z0-9_.:-]+$/)

const lockable = z.object({
  locked: z.boolean().default(false),
  lockReason: text.default(''),
}).strict().default({})

export const productionSourceModeSchema = z.enum(['novel', 'manual'])
export const productionPrepSectionSchema = z.enum([
  'bible',
  'asset_cards',
  'episode_plan',
  'episode_script',
  'scene_breakdown',
  'shot_plan',
  'review',
])

export const productionBibleSchema = z.object({
  logline: text.default(''),
  synopsis: text.default(''),
  genres: textList,
  themes: textList,
  audience: text.default(''),
  toneKeywords: textList,
  worldRules: textList,
  narrativePov: text.default(''),
  episodeStrategy: text.default(''),
  continuityRisks: textList,
}).strict()

export const characterCardSchema = z.object({
  id: idText,
  name: requiredText,
  aliases: textList,
  role: text.default(''),
  biography: text.default(''),
  personality: text.default(''),
  goals: textList,
  relationships: z.record(text).default({}),
  appearance: text.default(''),
  wardrobe: text.default(''),
  voice: text.default(''),
  continuityNotes: textList,
  lock: lockable,
}).strict()

export const locationCardSchema = z.object({
  id: idText,
  name: requiredText,
  summary: text.default(''),
  geography: text.default(''),
  atmosphere: text.default(''),
  timePeriod: text.default(''),
  visualAnchors: textList,
  practicalNotes: textList,
  continuityNotes: textList,
  lock: lockable,
}).strict()

export const propCardSchema = z.object({
  id: idText,
  name: requiredText,
  summary: text.default(''),
  ownerCharacterIds: textList,
  visualAnchors: textList,
  storyFunction: text.default(''),
  continuityNotes: textList,
  lock: lockable,
}).strict()

export const styleBibleSchema = z.object({
  visualStyle: text.default(''),
  cameraLanguage: text.default(''),
  colorPalette: textList,
  lighting: text.default(''),
  artDirection: text.default(''),
  editRhythm: text.default(''),
  soundscape: text.default(''),
  imageNegativePrompts: textList,
  videoNegativePrompts: textList,
  referenceNotes: textList,
  lock: lockable,
}).strict()

export const productionAssetCardsSchema = z.object({
  characters: z.array(characterCardSchema).default([]),
  locations: z.array(locationCardSchema).default([]),
  props: z.array(propCardSchema).default([]),
  style: styleBibleSchema.default({}),
}).strict()

export const episodePlanSchema = z.object({
  id: idText,
  episodeNumber: z.number().int().positive(),
  title: requiredText,
  summary: text.default(''),
  targetDurationSeconds: z.number().int().positive(),
  minDurationSeconds: z.number().int().positive().optional(),
  maxDurationSeconds: z.number().int().positive().optional(),
  pacing: z.enum(['slow', 'balanced', 'fast']).default('balanced'),
  beats: textList,
  cliffhanger: text.default(''),
  continuityFocus: textList,
}).strict()

export const productionElementsSchema = z.object({
  castCharacterIds: textList,
  extras: textList,
  props: textList,
  setDressing: textList,
  costumes: textList,
  makeup: textList,
  vfx: textList,
  sound: textList,
  music: textList,
  specialEquipment: textList,
}).strict()

export const sceneBreakdownSchema = z.object({
  id: idText,
  episodeId: idText,
  sceneNumber: z.number().int().positive(),
  title: requiredText,
  setting: requiredText,
  timeOfDay: text.default(''),
  summary: text.default(''),
  dramaticPurpose: text.default(''),
  estimatedDurationSeconds: z.number().int().positive(),
  characterIds: textList,
  locationIds: textList,
  propIds: textList,
  productionElements: productionElementsSchema.default({}),
  continuityNotes: textList,
}).strict()

export const shotPlanSchema = z.object({
  id: idText,
  sceneId: idText,
  shotNumber: z.number().int().positive(),
  description: requiredText,
  shotType: text.default(''),
  cameraMove: text.default(''),
  lens: text.default(''),
  framing: text.default(''),
  durationSeconds: z.number().positive(),
  characterIds: textList,
  locationIds: textList,
  propIds: textList,
  dialogue: text.default(''),
  action: text.default(''),
  imagePrompt: text.default(''),
  videoPrompt: text.default(''),
  referenceAssetIds: textList,
  continuityNotes: textList,
}).strict()

export const continuityRulesSchema = z.object({
  globalRules: textList,
  characterRules: z.record(textList).default({}),
  locationRules: z.record(textList).default({}),
  propRules: z.record(textList).default({}),
  lockedAssetIds: textList,
  forbiddenChanges: textList,
}).strict()

export const productionReviewStateSchema = z.object({
  humanReviewRequired: z.boolean().default(false),
  lockedAssetIds: textList,
  pendingQuestions: textList,
  approvedCheckpoints: textList,
}).strict()

export const productionPrepMetadataSchema = z.object({
  language: text.default('zh-CN'),
  sourceDigest: text.default(''),
  createdAt: text.default(''),
  updatedAt: text.default(''),
  notes: textList,
}).strict()
