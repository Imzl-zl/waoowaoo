import { productionPrepDocumentSchema } from './document-schema'
import type { ProductionPrepDocument } from './types'

export type ProductionPrepValidationIssueCode =
  | 'INVALID_SCHEMA'
  | 'DUPLICATE_ID'
  | 'INVALID_DURATION_RANGE'
  | 'UNKNOWN_EPISODE_REFERENCE'
  | 'UNKNOWN_SCENE_REFERENCE'
  | 'UNKNOWN_CHARACTER_REFERENCE'
  | 'UNKNOWN_LOCATION_REFERENCE'
  | 'UNKNOWN_PROP_REFERENCE'

export type ProductionPrepValidationIssue = Readonly<{
  code: ProductionPrepValidationIssueCode
  message: string
  path: string
}>

export type ProductionPrepValidationResult = Readonly<{
  valid: boolean
  document?: ProductionPrepDocument
  issues: readonly ProductionPrepValidationIssue[]
}>

function addDuplicateIssues(
  ids: readonly string[],
  path: string,
  issues: ProductionPrepValidationIssue[],
) {
  const seen = new Set<string>()
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      continue
    }
    issues.push({
      code: 'DUPLICATE_ID',
      message: `Duplicate production prep id: ${id}`,
      path,
    })
  }
}

function addUnknownReferenceIssues(params: {
  ids: readonly string[]
  knownIds: ReadonlySet<string>
  code: ProductionPrepValidationIssueCode
  path: string
  label: string
  issues: ProductionPrepValidationIssue[]
}) {
  for (const id of params.ids) {
    if (params.knownIds.has(id)) continue
    params.issues.push({
      code: params.code,
      message: `Unknown ${params.label} reference: ${id}`,
      path: params.path,
    })
  }
}

function validateEpisodePlans(
  document: ProductionPrepDocument,
  issues: ProductionPrepValidationIssue[],
) {
  addDuplicateIssues(document.episodePlans.map((episode) => episode.id), 'episodePlans', issues)
  for (const episode of document.episodePlans) {
    const { minDurationSeconds, targetDurationSeconds, maxDurationSeconds } = episode
    const minInvalid = minDurationSeconds !== undefined && minDurationSeconds > targetDurationSeconds
    const maxInvalid = maxDurationSeconds !== undefined && maxDurationSeconds < targetDurationSeconds
    if (!minInvalid && !maxInvalid) continue
    issues.push({
      code: 'INVALID_DURATION_RANGE',
      message: `Episode ${episode.id} duration range must contain target duration`,
      path: `episodePlans.${episode.id}`,
    })
  }
}

function validateSceneBreakdowns(
  document: ProductionPrepDocument,
  issues: ProductionPrepValidationIssue[],
) {
  const episodeIds = new Set(document.episodePlans.map((episode) => episode.id))
  const characterIds = new Set(document.assets.characters.map((character) => character.id))
  const locationIds = new Set(document.assets.locations.map((location) => location.id))
  const propIds = new Set(document.assets.props.map((prop) => prop.id))
  addDuplicateIssues(document.sceneBreakdowns.map((scene) => scene.id), 'sceneBreakdowns', issues)
  for (const scene of document.sceneBreakdowns) {
    if (!episodeIds.has(scene.episodeId)) {
      issues.push({
        code: 'UNKNOWN_EPISODE_REFERENCE',
        message: `Scene ${scene.id} references unknown episode ${scene.episodeId}`,
        path: `sceneBreakdowns.${scene.id}.episodeId`,
      })
    }
    addUnknownReferenceIssues({
      ids: scene.characterIds,
      knownIds: characterIds,
      code: 'UNKNOWN_CHARACTER_REFERENCE',
      path: `sceneBreakdowns.${scene.id}.characterIds`,
      label: 'character',
      issues,
    })
    addUnknownReferenceIssues({
      ids: scene.locationIds,
      knownIds: locationIds,
      code: 'UNKNOWN_LOCATION_REFERENCE',
      path: `sceneBreakdowns.${scene.id}.locationIds`,
      label: 'location',
      issues,
    })
    addUnknownReferenceIssues({
      ids: scene.propIds,
      knownIds: propIds,
      code: 'UNKNOWN_PROP_REFERENCE',
      path: `sceneBreakdowns.${scene.id}.propIds`,
      label: 'prop',
      issues,
    })
  }
}

function validateShotPlans(
  document: ProductionPrepDocument,
  issues: ProductionPrepValidationIssue[],
) {
  const sceneIds = new Set(document.sceneBreakdowns.map((scene) => scene.id))
  const characterIds = new Set(document.assets.characters.map((character) => character.id))
  const locationIds = new Set(document.assets.locations.map((location) => location.id))
  const propIds = new Set(document.assets.props.map((prop) => prop.id))
  addDuplicateIssues(document.shotPlans.map((shot) => shot.id), 'shotPlans', issues)
  for (const shot of document.shotPlans) {
    if (!sceneIds.has(shot.sceneId)) {
      issues.push({
        code: 'UNKNOWN_SCENE_REFERENCE',
        message: `Shot ${shot.id} references unknown scene ${shot.sceneId}`,
        path: `shotPlans.${shot.id}.sceneId`,
      })
    }
    addUnknownReferenceIssues({
      ids: shot.characterIds,
      knownIds: characterIds,
      code: 'UNKNOWN_CHARACTER_REFERENCE',
      path: `shotPlans.${shot.id}.characterIds`,
      label: 'character',
      issues,
    })
    addUnknownReferenceIssues({
      ids: shot.locationIds,
      knownIds: locationIds,
      code: 'UNKNOWN_LOCATION_REFERENCE',
      path: `shotPlans.${shot.id}.locationIds`,
      label: 'location',
      issues,
    })
    addUnknownReferenceIssues({
      ids: shot.propIds,
      knownIds: propIds,
      code: 'UNKNOWN_PROP_REFERENCE',
      path: `shotPlans.${shot.id}.propIds`,
      label: 'prop',
      issues,
    })
  }
}

export function validateProductionPrepDocument(input: unknown): ProductionPrepValidationResult {
  const parsed = productionPrepDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: 'INVALID_SCHEMA',
        message: issue.message,
        path: issue.path.join('.'),
      })),
    }
  }

  const issues: ProductionPrepValidationIssue[] = []
  addDuplicateIssues(parsed.data.assets.characters.map((item) => item.id), 'assets.characters', issues)
  addDuplicateIssues(parsed.data.assets.locations.map((item) => item.id), 'assets.locations', issues)
  addDuplicateIssues(parsed.data.assets.props.map((item) => item.id), 'assets.props', issues)
  validateEpisodePlans(parsed.data, issues)
  validateSceneBreakdowns(parsed.data, issues)
  validateShotPlans(parsed.data, issues)

  return {
    valid: issues.length === 0,
    document: parsed.data,
    issues,
  }
}
