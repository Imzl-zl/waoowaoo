import type { WorkflowNodeTypeRegistration } from './canvas-types'
import {
  LLM_ANALYSIS_CONFIG,
  LLM_TRANSFORM_CONFIG,
  MEDIA_CONFIG,
  MERGE_CONFIG,
  PERSIST_CONFIG,
  SMOKE_CONFIG,
  TRANSFORM_CONFIG,
  USER_INPUT_CONFIG,
} from './node-config-catalog'
import {
  HUMAN_REVIEW_CONFIG,
  SCENE_BREAKDOWN_CONFIG,
  SHOT_PLAN_CONFIG,
  STORY_EXTRACT_BIBLE_CONFIG,
  STORY_PLAN_EPISODES_CONFIG,
} from './node-config-catalog-production'
import { MAIN_INPUT, MAIN_OUTPUT, NO_STEP, productionNode, stepRuntime } from './node-catalog-helpers'
import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-contract/node-types'

export { WORKFLOW_NODE_TYPES } from '@/lib/workflow-contract/node-types'

const NODE_REGISTRATIONS: WorkflowNodeTypeRegistration[] = [
  {
    type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER,
    label: 'Manual trigger',
    category: 'trigger',
    ports: [MAIN_OUTPUT],
    runtime: NO_STEP,
  },
  {
    type: WORKFLOW_NODE_TYPES.USER_INPUT,
    label: 'User input',
    category: 'input',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: USER_INPUT_CONFIG,
    runtime: {
      producesStep: true,
      retryable: false,
      artifactTypes: ['input.value'],
      failureMode: 'fail_run',
    },
  },
  {
    type: WORKFLOW_NODE_TYPES.LLM_ANALYSIS,
    label: 'LLM analysis',
    category: 'ai',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: LLM_ANALYSIS_CONFIG,
    runtime: stepRuntime(['analysis.json']),
  },
  {
    type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
    label: 'LLM transform',
    category: 'ai',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: LLM_TRANSFORM_CONFIG,
    runtime: stepRuntime(['text.output']),
  },
  productionNode({
    type: WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE,
    label: 'Extract production bible',
    artifactType: 'production.prep.document',
    configSchema: STORY_EXTRACT_BIBLE_CONFIG,
  }),
  productionNode({
    type: WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES,
    label: 'Plan episodes',
    artifactType: 'production.episode.plan',
    configSchema: STORY_PLAN_EPISODES_CONFIG,
  }),
  productionNode({
    type: WORKFLOW_NODE_TYPES.SCENE_BREAKDOWN,
    label: 'Break down scenes',
    artifactType: 'production.scene.breakdown',
    configSchema: SCENE_BREAKDOWN_CONFIG,
  }),
  productionNode({
    type: WORKFLOW_NODE_TYPES.SHOT_PLAN,
    label: 'Plan shots',
    artifactType: 'production.shot.plan',
    configSchema: SHOT_PLAN_CONFIG,
  }),
  {
    type: WORKFLOW_NODE_TYPES.HUMAN_REVIEW,
    label: 'Human review',
    category: 'production',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: HUMAN_REVIEW_CONFIG,
    runtime: {
      producesStep: true,
      retryable: false,
      artifactTypes: ['review.required'],
      failureMode: 'fail_run',
    },
  },
  {
    type: WORKFLOW_NODE_TYPES.LOGIC_MERGE,
    label: 'Merge',
    category: 'logic',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: MERGE_CONFIG,
    runtime: NO_STEP,
  },
  {
    type: WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
    label: 'Runtime smoke',
    category: 'logic',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: SMOKE_CONFIG,
    runtime: {
      producesStep: true,
      retryable: false,
      artifactTypes: ['smoke.output'],
      failureMode: 'fail_run',
    },
  },
  {
    type: WORKFLOW_NODE_TYPES.DATA_TRANSFORM,
    label: 'Data transform',
    category: 'logic',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: TRANSFORM_CONFIG,
    runtime: stepRuntime(['data.output']),
  },
  {
    type: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
    label: 'Media generation',
    category: 'media',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: MEDIA_CONFIG,
    runtime: stepRuntime(['media.output']),
  },
  {
    type: WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST,
    label: 'Persist artifacts',
    category: 'data',
    ports: [MAIN_INPUT, MAIN_OUTPUT],
    configSchema: PERSIST_CONFIG,
    runtime: {
      producesStep: true,
      retryable: false,
      artifactTypes: [],
      failureMode: 'fail_run',
    },
  },
  {
    type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT,
    label: 'Output',
    category: 'output',
    ports: [MAIN_INPUT],
    runtime: NO_STEP,
  },
]

export const workflowNodeCatalog: ReadonlyMap<string, WorkflowNodeTypeRegistration> = new Map(
  NODE_REGISTRATIONS.map((registration) => [registration.type, registration]),
)

export function getWorkflowNodeRegistration(type: string): WorkflowNodeTypeRegistration | null {
  return workflowNodeCatalog.get(type) || null
}
