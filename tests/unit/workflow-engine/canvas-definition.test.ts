import { describe, expect, it } from 'vitest'
import { compileWorkflowCanvasDefinition } from '@/lib/workflow-engine/canvas-compiler'
import type { WorkflowCanvasDefinition, WorkflowCanvasNode } from '@/lib/workflow-engine/canvas-types'
import { validateWorkflowCanvasDefinition } from '@/lib/workflow-engine/canvas-validation'
import { createDefaultWorkflowNodeConfig } from '@/lib/workflow-engine/node-config'
import { WORKFLOW_NODE_TYPES, getWorkflowNodeRegistration } from '@/lib/workflow-engine/node-catalog'

function withDefaultConfig(node: WorkflowCanvasNode): WorkflowCanvasNode {
  if (node.config !== undefined) return node
  const registration = getWorkflowNodeRegistration(node.type)
  if (!registration) return node
  const config = createDefaultWorkflowNodeConfig(registration)
  return config ? { ...node, config } : node
}

function buildCanvas(overrides: Partial<WorkflowCanvasDefinition> = {}): WorkflowCanvasDefinition {
  const definition: WorkflowCanvasDefinition = {
    schemaVersion: 1,
    workflowType: 'custom.workflow',
    title: 'Custom workflow',
    nodes: [
      { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
      {
        id: 'draft',
        type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
        step: {
          key: 'write_draft',
          artifactTypes: ['draft.text'],
        },
      },
      {
        id: 'persist',
        type: WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST,
      },
      { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
    ],
    edges: [
      { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
      { id: 'draft-persist', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'persist', targetPort: 'in' },
      { id: 'persist-output', sourceNodeId: 'persist', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
    ],
    ...overrides,
  }
  return {
    ...definition,
    nodes: definition.nodes.map(withDefaultConfig),
  }
}

function validationCodes(definition: WorkflowCanvasDefinition) {
  return validateWorkflowCanvasDefinition(definition).errors.map((error) => error.code)
}

function validationErrors(definition: WorkflowCanvasDefinition) {
  return validateWorkflowCanvasDefinition(definition).errors
}

describe('workflow canvas definition', () => {
  it('declares user-visible node catalog metadata separately from runtime execution', () => {
    expect(getWorkflowNodeRegistration(WORKFLOW_NODE_TYPES.LLM_TRANSFORM)).toEqual(expect.objectContaining({
      category: 'ai',
      ports: expect.arrayContaining([
        expect.objectContaining({ key: 'in', direction: 'input' }),
        expect.objectContaining({ key: 'out', direction: 'output' }),
      ]),
      runtime: expect.objectContaining({
        producesStep: true,
        retryable: true,
      }),
      configSchema: expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ key: 'instruction', required: true }),
          expect.objectContaining({ key: 'outputFormat', type: 'select' }),
        ]),
      }),
    }))
  })

  it('declares production-prep nodes as schema-driven executable workflow steps', () => {
    expect(getWorkflowNodeRegistration(WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE)).toEqual(expect.objectContaining({
      category: 'production',
      runtime: expect.objectContaining({
        producesStep: true,
        artifactTypes: ['production.prep.document'],
      }),
      configSchema: expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ key: 'sourceMode', defaultValue: 'novel' }),
          expect.objectContaining({ key: 'language', defaultValue: 'zh-CN' }),
        ]),
      }),
    }))
    expect(createDefaultWorkflowNodeConfig(
      getWorkflowNodeRegistration(WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES)!,
    )).toEqual(expect.objectContaining({
      targetEpisodeCount: 1,
      targetDurationSeconds: 900,
      pacing: 'balanced',
      language: 'zh-CN',
    }))
    expect(getWorkflowNodeRegistration(WORKFLOW_NODE_TYPES.HUMAN_REVIEW)).toEqual(expect.objectContaining({
      category: 'production',
      runtime: expect.objectContaining({
        producesStep: true,
        retryable: false,
        artifactTypes: ['review.required'],
      }),
    }))
  })

  it('validates a canvas definition with trigger, output, known ports, and acyclic edges', () => {
    expect(validateWorkflowCanvasDefinition(buildCanvas())).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('compiles a valid canvas definition into an ordered workflow definition', () => {
    const retryResolver = ({ stepKey }: { stepKey: string; existingStepKeys: string[] }) => [stepKey]
    const compiled = compileWorkflowCanvasDefinition(buildCanvas(), retryResolver)

    expect(compiled.workflowType).toBe('custom.workflow')
    expect(compiled.orderedSteps).toEqual([
      {
        key: 'write_draft',
        dependsOn: [],
        retryable: true,
        artifactTypes: ['draft.text'],
        failureMode: 'fail_run',
      },
      {
        key: 'persist',
        dependsOn: ['write_draft'],
        retryable: false,
        artifactTypes: [],
        failureMode: 'fail_run',
      },
    ])
    expect(compiled.resolveRetryInvalidationStepKeys({
      stepKey: 'write_draft',
      existingStepKeys: ['write_draft'],
    })).toEqual(['write_draft'])
  })

  it('validates node config against catalog schemas', () => {
    const missing = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        {
          id: 'draft',
          type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
          config: {},
          step: { key: 'write_draft' },
        },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
        { id: 'draft-output', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })
    const wrongType = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        {
          id: 'draft',
          type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
          config: { instruction: 'Write', outputFormat: 'text', temperature: 'hot' },
          step: { key: 'write_draft' },
        },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
        { id: 'draft-output', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })
    const invalidOption = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        {
          id: 'draft',
          type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
          config: { instruction: 'Write', outputFormat: 'xml', temperature: 0.5 },
          step: { key: 'write_draft' },
        },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
        { id: 'draft-output', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })
    const unknownField = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        {
          id: 'draft',
          type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
          config: { instruction: 'Write', outputFormat: 'text', extra: 'nope' },
          step: { key: 'write_draft' },
        },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
        { id: 'draft-output', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })

    expect(validationErrors(missing)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CONFIG_FIELD_REQUIRED', configKey: 'instruction' }),
      expect.objectContaining({ code: 'CONFIG_FIELD_REQUIRED', configKey: 'outputFormat' }),
    ]))
    expect(validationErrors(wrongType)).toContainEqual(expect.objectContaining({
      code: 'INVALID_CONFIG_FIELD_TYPE',
      configKey: 'temperature',
    }))
    expect(validationErrors(invalidOption)).toContainEqual(expect.objectContaining({
      code: 'INVALID_CONFIG_FIELD_OPTION',
      configKey: 'outputFormat',
    }))
    expect(validationErrors(unknownField)).toContainEqual(expect.objectContaining({
      code: 'UNKNOWN_CONFIG_FIELD',
      configKey: 'extra',
    }))
  })

  it('validates conditional node config requirements before runtime execution', () => {
    const definition = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        {
          id: 'transform',
          type: WORKFLOW_NODE_TYPES.DATA_TRANSFORM,
          config: { mode: 'template', template: ' ' },
          step: { key: 'render_text' },
        },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-transform', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'transform', targetPort: 'in' },
        { id: 'transform-output', sourceNodeId: 'transform', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })

    expect(validationErrors(definition)).toContainEqual(expect.objectContaining({
      code: 'CONFIG_FIELD_REQUIRED',
      configKey: 'template',
      nodeId: 'transform',
    }))
  })

  it('validates production node config before runtime execution', () => {
    const definition = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        {
          id: 'episodes',
          type: WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES,
          config: {
            targetEpisodeCount: 1,
            targetDurationSeconds: 900,
            pacing: 'rushed',
            language: 'zh-CN',
          },
        },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-episodes', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'episodes', targetPort: 'in' },
        { id: 'episodes-output', sourceNodeId: 'episodes', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })

    expect(validationErrors(definition)).toContainEqual(expect.objectContaining({
      code: 'INVALID_CONFIG_FIELD_OPTION',
      configKey: 'pacing',
      nodeId: 'episodes',
    }))
  })

  it('keeps step dependencies across non-step routing nodes', () => {
    const routedCanvas = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        { id: 'draft', type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM, step: { key: 'write_draft' } },
        { id: 'merge', type: WORKFLOW_NODE_TYPES.LOGIC_MERGE },
        { id: 'persist', type: WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
        { id: 'draft-merge', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'merge', targetPort: 'in' },
        { id: 'merge-persist', sourceNodeId: 'merge', sourcePort: 'out', targetNodeId: 'persist', targetPort: 'in' },
        { id: 'persist-output', sourceNodeId: 'persist', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })

    const compiled = compileWorkflowCanvasDefinition(routedCanvas, ({ stepKey }) => [stepKey])

    expect(compiled.orderedSteps).toEqual([
      expect.objectContaining({ key: 'write_draft', dependsOn: [] }),
      expect.objectContaining({ key: 'persist', dependsOn: ['write_draft'] }),
    ])
  })

  it('exposes validation errors for duplicate ids, unknown node types, and unknown ports', () => {
    const definition = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        { id: 'trigger', type: 'unknown.node' },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'bad-port', sourceNodeId: 'trigger', sourcePort: 'missing', targetNodeId: 'output', targetPort: 'in' },
      ],
    })

    expect(validationCodes(definition)).toEqual(expect.arrayContaining([
      'DUPLICATE_NODE_ID',
      'UNKNOWN_NODE_TYPE',
      'UNKNOWN_PORT',
    ]))
  })

  it('rejects missing trigger/output boundaries and invalid edge direction', () => {
    const definition = buildCanvas({
      nodes: [
        { id: 'draft', type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM },
      ],
      edges: [
        { id: 'bad-direction', sourceNodeId: 'draft', sourcePort: 'in', targetNodeId: 'draft', targetPort: 'out' },
      ],
    })

    expect(validationCodes(definition)).toEqual(expect.arrayContaining([
      'MISSING_TRIGGER',
      'MISSING_OUTPUT',
      'INVALID_PORT_DIRECTION',
      'WORKFLOW_HAS_CYCLE',
    ]))
  })

  it('rejects cyclic definitions before compilation', () => {
    const cyclic = buildCanvas({
      edges: [
        { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
        { id: 'draft-persist', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'persist', targetPort: 'in' },
        { id: 'persist-draft', sourceNodeId: 'persist', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
        { id: 'persist-output', sourceNodeId: 'persist', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })

    expect(validationCodes(cyclic)).toContain('WORKFLOW_HAS_CYCLE')
    expect(() => compileWorkflowCanvasDefinition(cyclic, ({ stepKey }) => [stepKey]))
      .toThrow('Invalid workflow canvas definition: WORKFLOW_HAS_CYCLE')
  })

  it('rejects duplicate compiled step keys', () => {
    const duplicateSteps = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        { id: 'draft', type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM, step: { key: 'same_step' } },
        { id: 'review', type: WORKFLOW_NODE_TYPES.LLM_ANALYSIS, step: { key: 'same_step' } },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
        { id: 'draft-review', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'review', targetPort: 'in' },
        { id: 'review-output', sourceNodeId: 'review', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })

    expect(validationCodes(duplicateSteps)).toContain('DUPLICATE_STEP_KEY')
  })

  it('rejects disconnected node islands', () => {
    const disconnected = buildCanvas({
      nodes: [
        { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
        { id: 'main', type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM },
        { id: 'orphan', type: WORKFLOW_NODE_TYPES.LLM_ANALYSIS },
        { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
      ],
      edges: [
        { id: 'trigger-main', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'main', targetPort: 'in' },
        { id: 'main-output', sourceNodeId: 'main', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
      ],
    })

    expect(validationCodes(disconnected)).toEqual(expect.arrayContaining([
      'NODE_NOT_REACHABLE_FROM_SOURCE',
      'NODE_CANNOT_REACH_OUTPUT',
    ]))
  })
})
