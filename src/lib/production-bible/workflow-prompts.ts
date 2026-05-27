import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-contract/node-types'
import type { ProductionNodeOutputKind } from './node-output'

function stringConfig(
  config: Readonly<Record<string, unknown>>,
  key: string,
  fallback = '',
): string {
  const value = config[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function numberConfig(
  config: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number,
): number {
  const value = config[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function baseInstruction(config: Readonly<Record<string, unknown>>): string {
  const language = stringConfig(config, 'language', 'zh-CN')
  const extraInstruction = stringConfig(config, 'instruction')
  return [
    `Write in ${language}.`,
    'Treat upstream workflow outputs as the only source material.',
    'Preserve continuity; do not invent contradictions when information is missing.',
    'Use stable ids with lowercase words separated by dots, for example char.lead or scene.1.',
    extraInstruction ? `Additional user instruction: ${extraInstruction}` : '',
  ].filter(Boolean).join('\n')
}

export function productionNodeOutputKind(nodeType: string): ProductionNodeOutputKind {
  if (nodeType === WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE) return 'production.prep.document'
  if (nodeType === WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES) return 'production.episode.plan'
  if (nodeType === WORKFLOW_NODE_TYPES.SCENE_BREAKDOWN) return 'production.scene.breakdown'
  if (nodeType === WORKFLOW_NODE_TYPES.SHOT_PLAN) return 'production.shot.plan'
  throw new Error(`unsupported production workflow node type: ${nodeType}`)
}

export function buildProductionWorkflowInstruction(params: {
  nodeType: string
  config: Readonly<Record<string, unknown>>
}): string {
  const { nodeType, config } = params
  const base = baseInstruction(config)

  if (nodeType === WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE) {
    return [
      base,
      'Extract or compose a complete ProductionPrepDocument JSON object.',
      'Support both sourceMode values: novel for automatic novel extraction, manual for user-authored premise/settings.',
      'Include bible, character cards, location cards, prop cards, style bible, continuity rules, review state, and metadata.',
      'If episode or shot details are not available yet, return empty episodePlans, sceneBreakdowns, and shotPlans arrays.',
      'The JSON must match schemaVersion 1 exactly.',
    ].join('\n')
  }

  if (nodeType === WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES) {
    const count = numberConfig(config, 'targetEpisodeCount', 1)
    const target = numberConfig(config, 'targetDurationSeconds', 900)
    const min = numberConfig(config, 'minDurationSeconds', Math.max(60, target - 120))
    const max = numberConfig(config, 'maxDurationSeconds', target + 120)
    const pacing = stringConfig(config, 'pacing', 'balanced')
    return [
      base,
      'Create an episode planning JSON object with key "episodePlans".',
      `Plan ${count} episode(s). Each episode target duration is ${target} seconds, min ${min}, max ${max}.`,
      `Use ${pacing} pacing and include beats, continuityFocus, and cliffhanger fields.`,
      'Do not write screenplay dialogue here; this node only plans episode structure.',
    ].join('\n')
  }

  if (nodeType === WORKFLOW_NODE_TYPES.SCENE_BREAKDOWN) {
    const episodeId = stringConfig(config, 'targetEpisodeId', 'ep.1')
    const sceneCount = numberConfig(config, 'targetSceneCount', 8)
    const duration = numberConfig(config, 'targetDurationSeconds', 900)
    return [
      base,
      'Create a scene breakdown JSON object with key "sceneBreakdowns".',
      `Break episode ${episodeId} into about ${sceneCount} scene(s) for ${duration} seconds total.`,
      'For each scene include setting, dramaticPurpose, productionElements, characterIds, locationIds, propIds, and continuityNotes.',
      'Use the pre-production breakdown mindset: identify cast, extras, props, set dressing, costumes, makeup, VFX, sound, music, and special equipment.',
    ].join('\n')
  }

  if (nodeType !== WORKFLOW_NODE_TYPES.SHOT_PLAN) {
    throw new Error(`unsupported production workflow node type: ${nodeType}`)
  }

  const averageShotDuration = numberConfig(config, 'averageShotDurationSeconds', 6)
  const detailLevel = stringConfig(config, 'detailLevel', 'standard')
  return [
    base,
    'Create a shot planning JSON object with key "shotPlans".',
    `Use an average shot duration near ${averageShotDuration} seconds and ${detailLevel} detail.`,
    'For each shot include description, shotType, cameraMove, framing, action, dialogue, imagePrompt, videoPrompt, references, and continuityNotes.',
    'Shot prompts must carry forward character, location, prop, and style continuity from upstream production assets.',
  ].join('\n')
}
