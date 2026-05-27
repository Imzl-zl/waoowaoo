import type { WorkflowNodeConfigSchema } from './canvas-types'

const LANGUAGE_FIELD = {
  key: 'language',
  label: 'Language',
  type: 'text',
  required: true,
  defaultValue: 'zh-CN',
} as const

const INSTRUCTION_FIELD = {
  key: 'instruction',
  label: 'Instruction',
  type: 'textarea',
  defaultValue: '',
} as const

export const STORY_EXTRACT_BIBLE_CONFIG = {
  fields: [
    {
      key: 'sourceMode',
      label: 'Source mode',
      type: 'select',
      required: true,
      defaultValue: 'novel',
      options: [
        { value: 'novel', label: 'Novel extraction' },
        { value: 'manual', label: 'Manual premise' },
      ],
    },
    LANGUAGE_FIELD,
    INSTRUCTION_FIELD,
  ],
} as const satisfies WorkflowNodeConfigSchema

export const STORY_PLAN_EPISODES_CONFIG = {
  fields: [
    { key: 'targetEpisodeCount', label: 'Episodes', type: 'number', required: true, defaultValue: 1, min: 1, max: 200, step: 1 },
    { key: 'targetDurationSeconds', label: 'Target seconds', type: 'number', required: true, defaultValue: 900, min: 60, max: 10800, step: 60 },
    { key: 'minDurationSeconds', label: 'Min seconds', type: 'number', defaultValue: 780, min: 30, max: 10800, step: 60 },
    { key: 'maxDurationSeconds', label: 'Max seconds', type: 'number', defaultValue: 1020, min: 60, max: 14400, step: 60 },
    {
      key: 'pacing',
      label: 'Pacing',
      type: 'select',
      required: true,
      defaultValue: 'balanced',
      options: [
        { value: 'slow', label: 'Slow' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'fast', label: 'Fast' },
      ],
    },
    LANGUAGE_FIELD,
    INSTRUCTION_FIELD,
  ],
} as const satisfies WorkflowNodeConfigSchema

export const SCENE_BREAKDOWN_CONFIG = {
  fields: [
    { key: 'targetEpisodeId', label: 'Episode ID', type: 'text', required: true, defaultValue: 'ep.1' },
    { key: 'targetSceneCount', label: 'Scenes', type: 'number', required: true, defaultValue: 8, min: 1, max: 100, step: 1 },
    { key: 'targetDurationSeconds', label: 'Target seconds', type: 'number', required: true, defaultValue: 900, min: 60, max: 10800, step: 60 },
    LANGUAGE_FIELD,
    INSTRUCTION_FIELD,
  ],
} as const satisfies WorkflowNodeConfigSchema

export const SHOT_PLAN_CONFIG = {
  fields: [
    { key: 'averageShotDurationSeconds', label: 'Avg shot seconds', type: 'number', required: true, defaultValue: 6, min: 1, max: 60, step: 1 },
    {
      key: 'detailLevel',
      label: 'Detail level',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      options: [
        { value: 'lean', label: 'Lean' },
        { value: 'standard', label: 'Standard' },
        { value: 'detailed', label: 'Detailed' },
      ],
    },
    LANGUAGE_FIELD,
    INSTRUCTION_FIELD,
  ],
} as const satisfies WorkflowNodeConfigSchema

export const HUMAN_REVIEW_CONFIG = {
  fields: [
    { key: 'checkpointName', label: 'Checkpoint', type: 'text', required: true, defaultValue: 'production-prep-review' },
    { key: 'required', label: 'Review required', type: 'boolean', defaultValue: true },
    { key: 'instructions', label: 'Instructions', type: 'textarea', defaultValue: 'Review continuity, locked assets, episode pacing, scene requirements, and shot prompts before media generation.' },
  ],
} as const satisfies WorkflowNodeConfigSchema
