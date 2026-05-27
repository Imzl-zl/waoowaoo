import { describe, expect, it } from 'vitest'
import {
  addWorkflowCanvasNode,
  connectWorkflowCanvasNodes,
  createDefaultWorkflowCanvasDefinition,
  moveWorkflowCanvasNode,
  removeWorkflowCanvasEdge,
  removeWorkflowCanvasNode,
  updateWorkflowCanvasMetadata,
  updateWorkflowCanvasNode,
  updateWorkflowCanvasNodeConfig,
  updateWorkflowCanvasNodePosition,
} from '@/lib/workflow-engine/canvas-editor'
import { validateWorkflowCanvasDefinition } from '@/lib/workflow-engine/canvas-validation'
import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-engine/node-catalog'

describe('workflow canvas editor helpers', () => {
  it('creates a valid draft with trigger and output boundary nodes', () => {
    const definition = createDefaultWorkflowCanvasDefinition()

    expect(definition.nodes.map((node) => node.type)).toEqual([
      WORKFLOW_NODE_TYPES.MANUAL_TRIGGER,
      WORKFLOW_NODE_TYPES.OUTPUT_RESULT,
    ])
    expect(definition.edges).toEqual([
      expect.objectContaining({
        sourceNodeId: 'trigger',
        targetNodeId: 'output',
      }),
    ])
    expect(validateWorkflowCanvasDefinition(definition).valid).toBe(true)
  })

  it('inserts step nodes before output and bridges the main chain', () => {
    const definition = addWorkflowCanvasNode(
      createDefaultWorkflowCanvasDefinition(),
      WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
    )

    expect(definition.nodes.map((node) => node.type)).toEqual([
      WORKFLOW_NODE_TYPES.MANUAL_TRIGGER,
      WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
      WORKFLOW_NODE_TYPES.OUTPUT_RESULT,
    ])
    expect(definition.edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId])).toEqual([
      ['trigger', 'llm_transform'],
      ['llm_transform', 'output'],
    ])
    expect(definition.nodes[1].step).toEqual(expect.objectContaining({
      retryable: true,
      failureMode: 'fail_run',
    }))
    expect(definition.nodes[1].config).toEqual(expect.objectContaining({
      instruction: 'Transform the upstream content for the next workflow step.',
      outputFormat: 'text',
      temperature: 0.7,
    }))
    expect(validateWorkflowCanvasDefinition(definition).valid).toBe(true)
  })

  it('updates node config immutably through the DSL helper', () => {
    const definition = addWorkflowCanvasNode(
      createDefaultWorkflowCanvasDefinition(),
      WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
    )
    const updated = updateWorkflowCanvasNodeConfig(definition, 'runtime_smoke', 'message', 'Run smoke check')

    expect(updated).not.toBe(definition)
    expect(definition.nodes.find((node) => node.id === 'runtime_smoke')?.config).toEqual({
      message: 'Smoke workflow step',
    })
    expect(updated.nodes.find((node) => node.id === 'runtime_smoke')?.config).toEqual({
      message: 'Run smoke check',
    })
    expect(validateWorkflowCanvasDefinition(updated).valid).toBe(true)
  })

  it('updates visual positions without changing edges', () => {
    const definition = addWorkflowCanvasNode(
      createDefaultWorkflowCanvasDefinition(),
      WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
    )
    const moved = updateWorkflowCanvasNodePosition(definition, 'runtime_smoke', { x: 420, y: 260 })

    expect(moved.nodes.find((node) => node.id === 'runtime_smoke')?.position).toEqual({ x: 420, y: 260 })
    expect(moved.edges).toEqual(definition.edges)
    expect(validateWorkflowCanvasDefinition(moved).valid).toBe(true)
  })

  it('connects and removes explicit DSL edges without storing UI state', () => {
    const definition = addWorkflowCanvasNode(
      createDefaultWorkflowCanvasDefinition(),
      WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
    )
    const withBranch = connectWorkflowCanvasNodes(definition, {
      sourceNodeId: 'trigger',
      sourcePort: 'out',
      targetNodeId: 'output',
      targetPort: 'in',
    })
    const duplicate = connectWorkflowCanvasNodes(withBranch, {
      sourceNodeId: 'trigger',
      sourcePort: 'out',
      targetNodeId: 'output',
      targetPort: 'in',
    })
    const removed = removeWorkflowCanvasEdge(duplicate, 'edge.trigger.out.output.in')

    expect(withBranch.edges.map((edge) => edge.id)).toContain('edge.trigger.out.output.in')
    expect(duplicate.edges).toHaveLength(withBranch.edges.length)
    expect(removed.edges.map((edge) => edge.id)).not.toContain('edge.trigger.out.output.in')
    expect(validateWorkflowCanvasDefinition(removed).valid).toBe(true)
  })

  it('preserves manual graph edges when adding another node before output', () => {
    const definition = addWorkflowCanvasNode(
      createDefaultWorkflowCanvasDefinition(),
      WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
    )
    const branched = connectWorkflowCanvasNodes(definition, {
      sourceNodeId: 'trigger',
      sourcePort: 'out',
      targetNodeId: 'output',
      targetPort: 'in',
    })
    const withTransform = addWorkflowCanvasNode(branched, WORKFLOW_NODE_TYPES.DATA_TRANSFORM)

    expect(withTransform.edges.map((edge) => edge.id)).toContain('edge.trigger.out.output.in')
    expect(withTransform.edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId])).toEqual(expect.arrayContaining([
      ['runtime_smoke', 'data_transform'],
      ['data_transform', 'output'],
    ]))
  })

  it('moves and removes non-boundary nodes without leaving dangling edges', () => {
    const withTransform = addWorkflowCanvasNode(
      createDefaultWorkflowCanvasDefinition(),
      WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
    )
    const withMedia = addWorkflowCanvasNode(withTransform, WORKFLOW_NODE_TYPES.MEDIA_GENERATE)
    const moved = moveWorkflowCanvasNode(withMedia, 'media_generate', -1)
    const removed = removeWorkflowCanvasNode(moved, 'llm_transform')

    expect(moved.nodes.map((node) => node.id)).toEqual([
      'trigger',
      'media_generate',
      'llm_transform',
      'output',
    ])
    expect(removed.nodes.map((node) => node.id)).toEqual([
      'trigger',
      'media_generate',
      'output',
    ])
    expect(removed.edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId])).toEqual([
      ['trigger', 'media_generate'],
      ['media_generate', 'output'],
    ])
    expect(validateWorkflowCanvasDefinition(removed).valid).toBe(true)
  })

  it('keeps boundary nodes fixed and updates metadata/node fields immutably', () => {
    const definition = addWorkflowCanvasNode(
      createDefaultWorkflowCanvasDefinition(),
      WORKFLOW_NODE_TYPES.LLM_ANALYSIS,
    )
    const withoutTriggerDelete = removeWorkflowCanvasNode(definition, 'trigger')
    const renamed = updateWorkflowCanvasMetadata(withoutTriggerDelete, {
      workflowType: 'custom.workflow.v2',
      title: 'Custom workflow v2',
    })
    const updatedNode = updateWorkflowCanvasNode(renamed, 'llm_analysis', {
      title: 'Analyze input',
      step: { key: 'analyze_input', artifactTypes: ['analysis.custom'], failureMode: 'fail_run' },
    })

    expect(withoutTriggerDelete.nodes[0].id).toBe('trigger')
    expect(updatedNode).not.toBe(definition)
    expect(updatedNode.workflowType).toBe('custom.workflow.v2')
    expect(updatedNode.nodes.find((node) => node.id === 'llm_analysis')).toEqual(expect.objectContaining({
      title: 'Analyze input',
      step: expect.objectContaining({ key: 'analyze_input' }),
    }))
  })
})
