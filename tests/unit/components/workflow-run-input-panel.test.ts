import { describe, expect, it } from 'vitest'
import {
  buildWorkflowExecutionInput,
  hasWorkflowRunInputFields,
  pruneWorkflowRunInputValues,
} from '@/app/[locale]/workspace/[projectId]/workflows/components/WorkflowRunInputPanel'
import type { WorkflowCanvasDefinition } from '@/lib/workflow-engine/canvas-types'
import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-engine/node-catalog'

function definitionWithUserInput(): WorkflowCanvasDefinition {
  return {
    schemaVersion: 1,
    workflowType: 'custom.workflow',
    title: 'Custom workflow',
    nodes: [
      { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
      {
        id: 'user_input',
        type: WORKFLOW_NODE_TYPES.USER_INPUT,
        title: 'Prompt',
        config: { outputKey: 'prompt', prompt: 'Describe the target' },
        step: { key: 'collect_prompt' },
      },
      {
        id: 'fallback_input',
        type: WORKFLOW_NODE_TYPES.USER_INPUT,
        config: { prompt: 'Audience' },
        step: { key: 'audience' },
      },
      { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
    ],
    edges: [
      { id: 'trigger-user', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'user_input', targetPort: 'in' },
      { id: 'user-fallback', sourceNodeId: 'user_input', sourcePort: 'out', targetNodeId: 'fallback_input', targetPort: 'in' },
      { id: 'fallback-output', sourceNodeId: 'fallback_input', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
    ],
  }
}

describe('workflow run input panel helpers', () => {
  it('derives execution input from input.user output keys without mutating the definition', () => {
    const definition = definitionWithUserInput()

    expect(buildWorkflowExecutionInput(definition, {
      prompt: 'Make it cinematic',
      audience: 'Creative team',
      unused: 'ignore me',
    })).toEqual({
      prompt: 'Make it cinematic',
      audience: 'Creative team',
    })
    expect(definition.nodes[1].config).toEqual({
      outputKey: 'prompt',
      prompt: 'Describe the target',
    })
  })

  it('prunes stale UI values to the current input.user fields', () => {
    expect(pruneWorkflowRunInputValues(definitionWithUserInput(), {
      prompt: 'Keep',
      audience: 'Keep too',
      stale: 'Drop',
    })).toEqual({
      prompt: 'Keep',
      audience: 'Keep too',
    })
  })

  it('detects definitions that do not require run input', () => {
    expect(hasWorkflowRunInputFields({
      schemaVersion: 1,
      workflowType: 'custom.empty',
      title: 'No runtime input',
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-output', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })).toBe(false)
  })
})
