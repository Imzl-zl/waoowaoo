import { TASK_TYPE } from '@/lib/task/types'
import type { WorkflowCanvasDefinition, WorkflowCanvasNode } from './canvas-types'
import { createDefaultWorkflowNodeConfig } from './node-config'
import { WORKFLOW_NODE_TYPES, getWorkflowNodeRegistration } from './node-catalog'

function withDefaultConfig(node: WorkflowCanvasNode): WorkflowCanvasNode {
  if (node.config !== undefined) return node
  const registration = getWorkflowNodeRegistration(node.type)
  if (!registration) return node
  const config = createDefaultWorkflowNodeConfig(registration)
  return config ? { ...node, config } : node
}

export const STORY_TO_SCRIPT_CANVAS_DEFINITION: WorkflowCanvasDefinition = {
  schemaVersion: 1,
  workflowType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
  title: 'Story to script',
  nodes: [
    { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
    {
      id: 'analyze_characters',
      type: WORKFLOW_NODE_TYPES.LLM_ANALYSIS,
      step: { artifactTypes: ['analysis.characters'] },
    },
    {
      id: 'analyze_locations',
      type: WORKFLOW_NODE_TYPES.LLM_ANALYSIS,
      step: { artifactTypes: ['analysis.locations'] },
    },
    {
      id: 'analyze_props',
      type: WORKFLOW_NODE_TYPES.LLM_ANALYSIS,
      step: { artifactTypes: ['analysis.props'] },
    },
    {
      id: 'split_clips',
      type: WORKFLOW_NODE_TYPES.DATA_TRANSFORM,
      step: { artifactTypes: ['clips.split'] },
    },
    {
      id: 'screenplay_convert',
      type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
      step: { artifactTypes: ['screenplay.clip'] },
    },
    {
      id: 'persist_script_artifacts',
      type: WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST,
    },
    { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
  ].map(withDefaultConfig),
  edges: [
    { id: 'trigger-characters', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'analyze_characters', targetPort: 'in' },
    { id: 'trigger-locations', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'analyze_locations', targetPort: 'in' },
    { id: 'trigger-props', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'analyze_props', targetPort: 'in' },
    { id: 'characters-split', sourceNodeId: 'analyze_characters', sourcePort: 'out', targetNodeId: 'split_clips', targetPort: 'in' },
    { id: 'locations-split', sourceNodeId: 'analyze_locations', sourcePort: 'out', targetNodeId: 'split_clips', targetPort: 'in' },
    { id: 'props-split', sourceNodeId: 'analyze_props', sourcePort: 'out', targetNodeId: 'split_clips', targetPort: 'in' },
    { id: 'split-screenplay', sourceNodeId: 'split_clips', sourcePort: 'out', targetNodeId: 'screenplay_convert', targetPort: 'in' },
    { id: 'screenplay-persist', sourceNodeId: 'screenplay_convert', sourcePort: 'out', targetNodeId: 'persist_script_artifacts', targetPort: 'in' },
    { id: 'persist-output', sourceNodeId: 'persist_script_artifacts', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
  ],
}

export const SCRIPT_TO_STORYBOARD_CANVAS_DEFINITION: WorkflowCanvasDefinition = {
  schemaVersion: 1,
  workflowType: TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
  title: 'Script to storyboard',
  nodes: [
    { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
    {
      id: 'plan_panels',
      type: WORKFLOW_NODE_TYPES.LLM_ANALYSIS,
      step: { artifactTypes: ['storyboard.clip.phase1'] },
    },
    {
      id: 'detail_panels',
      type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
      step: {
        artifactTypes: [
          'storyboard.clip.phase2_cinematography',
          'storyboard.clip.phase2_acting',
          'storyboard.clip.phase3',
        ],
      },
    },
    {
      id: 'voice_analyze',
      type: WORKFLOW_NODE_TYPES.LLM_ANALYSIS,
      step: { artifactTypes: ['voice.lines'] },
    },
    {
      id: 'persist_storyboard_artifacts',
      type: WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST,
    },
    { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
  ].map(withDefaultConfig),
  edges: [
    { id: 'trigger-plan', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'plan_panels', targetPort: 'in' },
    { id: 'plan-detail', sourceNodeId: 'plan_panels', sourcePort: 'out', targetNodeId: 'detail_panels', targetPort: 'in' },
    { id: 'detail-voice', sourceNodeId: 'detail_panels', sourcePort: 'out', targetNodeId: 'voice_analyze', targetPort: 'in' },
    { id: 'detail-persist', sourceNodeId: 'detail_panels', sourcePort: 'out', targetNodeId: 'persist_storyboard_artifacts', targetPort: 'in' },
    { id: 'voice-persist', sourceNodeId: 'voice_analyze', sourcePort: 'out', targetNodeId: 'persist_storyboard_artifacts', targetPort: 'in' },
    { id: 'persist-output', sourceNodeId: 'persist_storyboard_artifacts', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
  ],
}

export const BUILTIN_WORKFLOW_CANVAS_DEFINITIONS = [
  STORY_TO_SCRIPT_CANVAS_DEFINITION,
  SCRIPT_TO_STORYBOARD_CANVAS_DEFINITION,
] as const
