import type { WorkflowNodeConfigSchema } from './canvas-types'

export const USER_INPUT_CONFIG = {
  fields: [
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      required: true,
      defaultValue: 'Describe the input this workflow expects.',
    },
    {
      key: 'outputKey',
      label: 'Output key',
      type: 'text',
      required: true,
      defaultValue: 'input',
    },
  ],
} as const satisfies WorkflowNodeConfigSchema

export const LLM_ANALYSIS_CONFIG = {
  fields: [
    {
      key: 'instruction',
      label: 'Instruction',
      type: 'textarea',
      required: true,
      defaultValue: 'Analyze the upstream content and return structured findings.',
    },
    {
      key: 'outputFormat',
      label: 'Output format',
      type: 'select',
      required: true,
      defaultValue: 'json',
      options: [
        { value: 'json', label: 'JSON' },
        { value: 'text', label: 'Text' },
      ],
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'number',
      defaultValue: 0.4,
      min: 0,
      max: 2,
      step: 0.1,
    },
  ],
} as const satisfies WorkflowNodeConfigSchema

export const LLM_TRANSFORM_CONFIG = {
  fields: [
    {
      key: 'instruction',
      label: 'Instruction',
      type: 'textarea',
      required: true,
      defaultValue: 'Transform the upstream content for the next workflow step.',
    },
    {
      key: 'outputFormat',
      label: 'Output format',
      type: 'select',
      required: true,
      defaultValue: 'text',
      options: [
        { value: 'text', label: 'Text' },
        { value: 'json', label: 'JSON' },
      ],
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'number',
      defaultValue: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
    },
  ],
} as const satisfies WorkflowNodeConfigSchema

export const MERGE_CONFIG = {
  fields: [
    {
      key: 'strategy',
      label: 'Strategy',
      type: 'select',
      required: true,
      defaultValue: 'wait_all',
      options: [
        { value: 'wait_all', label: 'Wait for all inputs' },
        { value: 'first_available', label: 'First available input' },
      ],
    },
  ],
} as const satisfies WorkflowNodeConfigSchema

export const SMOKE_CONFIG = {
  fields: [
    {
      key: 'message',
      label: 'Message',
      type: 'text',
      required: true,
      defaultValue: 'Smoke workflow step',
    },
  ],
} as const satisfies WorkflowNodeConfigSchema

export const TRANSFORM_CONFIG = {
  fields: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      required: true,
      defaultValue: 'map',
      options: [
        { value: 'map', label: 'Map fields' },
        { value: 'template', label: 'Template text' },
      ],
    },
    {
      key: 'template',
      label: 'Template',
      type: 'textarea',
      requiredWhen: { key: 'mode', equals: 'template' },
      defaultValue: '',
    },
  ],
} as const satisfies WorkflowNodeConfigSchema

export const MEDIA_CONFIG = {
  fields: [
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      required: true,
      defaultValue: 'Describe the media to generate.',
    },
    {
      key: 'mediaKind',
      label: 'Media kind',
      type: 'select',
      required: true,
      defaultValue: 'image',
      options: [
        { value: 'image', label: 'Image' },
        { value: 'video', label: 'Video' },
        { value: 'audio', label: 'Audio' },
      ],
    },
    {
      key: 'imageModelSlot',
      label: 'Image model',
      type: 'select',
      requiredWhen: { key: 'mediaKind', equals: 'image' },
      defaultValue: 'storyboardModel',
      options: [
        { value: 'storyboardModel', label: 'Storyboard model' },
        { value: 'characterModel', label: 'Character model' },
        { value: 'locationModel', label: 'Location model' },
        { value: 'editModel', label: 'Edit model' },
      ],
      helpText: 'Uses the selected project image model; provider credentials stay in user API settings.',
    },
    {
      key: 'aspectRatio',
      label: 'Aspect ratio',
      type: 'text',
      defaultValue: '',
      placeholder: '16:9',
    },
    {
      key: 'videoDuration',
      label: 'Video duration',
      type: 'number',
      requiredWhen: { key: 'mediaKind', equals: 'video' },
      defaultValue: 5,
      min: 1,
      max: 30,
      step: 1,
    },
    {
      key: 'videoResolution',
      label: 'Video resolution',
      type: 'text',
      requiredWhen: { key: 'mediaKind', equals: 'video' },
      defaultValue: '720p',
      placeholder: '720p',
    },
    {
      key: 'generateAudio',
      label: 'Generate audio',
      type: 'boolean',
      defaultValue: false,
      helpText: 'Used only by video models that support audio generation.',
    },
    {
      key: 'audioVoice',
      label: 'Audio voice',
      type: 'text',
      requiredWhen: { key: 'mediaKind', equals: 'audio' },
      defaultValue: 'default',
      placeholder: 'default',
    },
    {
      key: 'audioRate',
      label: 'Audio rate',
      type: 'number',
      defaultValue: 1,
      min: 0.5,
      max: 2,
      step: 0.1,
    },
    {
      key: 'audioMaxFreezeSeconds',
      label: 'Audio max seconds',
      type: 'number',
      requiredWhen: { key: 'mediaKind', equals: 'audio' },
      defaultValue: 30,
      min: 5,
      max: 600,
      step: 1,
    },
  ],
} as const satisfies WorkflowNodeConfigSchema

export const PERSIST_CONFIG = {
  fields: [
    {
      key: 'artifactType',
      label: 'Artifact type',
      type: 'text',
      required: true,
      defaultValue: 'workflow.output',
    },
    {
      key: 'refId',
      label: 'Reference ID',
      type: 'text',
      required: true,
      defaultValue: 'result',
    },
  ],
} as const satisfies WorkflowNodeConfigSchema
