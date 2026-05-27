import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-errors'
import type { WorkflowCanvasDefinition, WorkflowCanvasNode } from '@/lib/workflow-engine/canvas-types'
import { createDefaultWorkflowNodeConfig } from '@/lib/workflow-engine/node-config'
import {
  assertPublishedWorkflowExecutionPlanExecutable,
  buildPublishedWorkflowExecutionPlan,
} from '@/lib/workflow-engine/published-definition-execution-plan'
import type { WorkflowDefinitionVersionDetail } from '@/lib/workflow-engine/definition-store-types'
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
        title: 'Write draft',
        step: { key: 'write_draft', artifactTypes: ['draft.text'] },
      },
      {
        id: 'persist',
        type: WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST,
        title: 'Persist result',
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

function buildVersion(overrides: Partial<WorkflowDefinitionVersionDetail> = {}): WorkflowDefinitionVersionDetail {
  const definition = overrides.definition || buildCanvas()
  return {
    id: 'version-1',
    workflowDefinitionId: 'definition-1',
    projectId: 'project-1',
    userId: 'user-1',
    workflowType: definition.workflowType,
    title: definition.title,
    version: 1,
    definition,
    validation: { valid: true, errors: [] },
    createdAt: new Date('2026-05-27T00:00:00.000Z'),
    ...overrides,
  }
}

describe('published definition execution plan', () => {
  it('builds a stable Temporal step descriptor plan from a published version', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion())

    expect(plan).toEqual(expect.objectContaining({
      workflowDefinitionId: 'definition-1',
      workflowDefinitionVersionId: 'version-1',
      workflowType: 'custom.workflow',
      title: 'Custom workflow',
      version: 1,
      executable: true,
    }))
    expect(plan.steps).toEqual([
      expect.objectContaining({
        nodeId: 'draft',
        nodeType: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
        nodeTitle: 'Write draft',
        stepKey: 'write_draft',
        dependsOn: [],
        retryable: true,
        artifactTypes: ['draft.text'],
        supported: true,
        temporalStep: {
          stepKey: 'write_draft',
          stepTitle: 'Write draft',
          stepIndex: 1,
          stepTotal: 2,
          attempt: 1,
        },
      }),
      expect.objectContaining({
        nodeId: 'persist',
        stepKey: 'persist',
        dependsOn: ['write_draft'],
        retryable: false,
        temporalStep: {
          stepKey: 'persist',
          stepTitle: 'Persist result',
          stepIndex: 2,
          stepTotal: 2,
          attempt: 1,
        },
      }),
    ])
    expect(plan.temporalSteps).toEqual(plan.steps.map((step) => step.temporalStep))
    expect(plan.publishedWorkflowSteps).toEqual(plan.steps.map((step) => step.publishedWorkflowStep))
  })

  it('rejects unsupported media kinds during published definition compilation', () => {
    expect(() => buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'media',
            type: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
            title: 'Generate media',
            config: {
              prompt: 'Generate media',
              mediaKind: 'mesh',
            },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-media', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'media', targetPort: 'in' },
          { id: 'media-output', sourceNodeId: 'media', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))).toThrow('Invalid workflow canvas definition: INVALID_CONFIG_FIELD_OPTION')
  })

  it('rejects video media generation without a direct image media dependency', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'media',
            type: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
            title: 'Generate video',
            config: {
              prompt: 'Generate video',
              mediaKind: 'video',
              videoDuration: 5,
              videoResolution: '720p',
            },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-media', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'media', targetPort: 'in' },
          { id: 'media-output', sourceNodeId: 'media', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(false)
    expect(plan.diagnostics).toEqual([
      expect.objectContaining({
        code: 'WORKFLOW_NODE_RUNTIME_INVALID_DEPENDENCY',
        nodeId: 'media',
        nodeType: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
        stepKey: 'media',
        message: expect.stringContaining('requires exactly one direct image media dependency'),
      }),
    ])
    expect(plan.unsupportedNodes).toEqual([])
  })

  it('treats image media generation as an executable provider-backed workflow step', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'media',
            type: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
            title: 'Generate image',
            config: {
              prompt: 'Generate an image',
              mediaKind: 'image',
              imageModelSlot: 'storyboardModel',
              aspectRatio: '16:9',
            },
            step: { key: 'generate_image' },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-media', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'media', targetPort: 'in' },
          { id: 'media-output', sourceNodeId: 'media', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.publishedWorkflowSteps).toEqual([
      expect.objectContaining({
        nodeId: 'media',
        nodeType: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
        stepKey: 'generate_image',
        config: {
          prompt: 'Generate an image',
          mediaKind: 'image',
          imageModelSlot: 'storyboardModel',
          aspectRatio: '16:9',
        },
      }),
    ])
  })

  it('treats audio media generation as an executable provider-backed workflow step', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'media',
            type: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
            title: 'Generate audio',
            config: {
              prompt: 'Narrate the scene',
              mediaKind: 'audio',
              audioVoice: 'voice-1',
              audioRate: 1,
              audioMaxFreezeSeconds: 30,
            },
            step: { key: 'generate_audio' },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-media', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'media', targetPort: 'in' },
          { id: 'media-output', sourceNodeId: 'media', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.publishedWorkflowSteps).toEqual([
      expect.objectContaining({
        nodeId: 'media',
        nodeType: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
        stepKey: 'generate_audio',
        config: {
          prompt: 'Narrate the scene',
          mediaKind: 'audio',
          audioVoice: 'voice-1',
          audioRate: 1,
          audioMaxFreezeSeconds: 30,
        },
      }),
    ])
  })

  it('treats video media generation as executable when directly fed by image media', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'image',
            type: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
            title: 'Generate image',
            config: {
              prompt: 'Generate an image',
              mediaKind: 'image',
              imageModelSlot: 'storyboardModel',
              aspectRatio: '16:9',
            },
            step: { key: 'generate_image' },
          },
          {
            id: 'video',
            type: WORKFLOW_NODE_TYPES.MEDIA_GENERATE,
            title: 'Generate video',
            config: {
              prompt: 'Animate the image',
              mediaKind: 'video',
              videoDuration: 5,
              videoResolution: '720p',
              generateAudio: false,
            },
            step: { key: 'generate_video' },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-image', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'image', targetPort: 'in' },
          { id: 'image-video', sourceNodeId: 'image', sourcePort: 'out', targetNodeId: 'video', targetPort: 'in' },
          { id: 'video-output', sourceNodeId: 'video', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.publishedWorkflowSteps).toEqual([
      expect.objectContaining({
        stepKey: 'generate_image',
        config: expect.objectContaining({ mediaKind: 'image' }),
      }),
      expect.objectContaining({
        stepKey: 'generate_video',
        dependsOn: ['generate_image'],
        config: expect.objectContaining({
          mediaKind: 'video',
          videoDuration: 5,
          videoResolution: '720p',
        }),
      }),
    ])
  })

  it('treats LLM transform as a provider-backed executable published workflow step', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion())

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.publishedWorkflowSteps[0]).toEqual(expect.objectContaining({
      nodeId: 'draft',
      nodeType: WORKFLOW_NODE_TYPES.LLM_TRANSFORM,
      stepKey: 'write_draft',
      config: {
        instruction: 'Transform the upstream content for the next workflow step.',
        outputFormat: 'text',
        temperature: 0.7,
      },
    }))
  })

  it('treats production-prep planning nodes as executable published workflow steps', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'bible',
            type: WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE,
            title: 'Extract bible',
            config: { sourceMode: 'novel', language: 'zh-CN', instruction: 'Keep the style grounded.' },
            step: { key: 'extract_bible' },
          },
          {
            id: 'episodes',
            type: WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES,
            title: 'Plan episodes',
            config: {
              targetEpisodeCount: 3,
              targetDurationSeconds: 900,
              minDurationSeconds: 780,
              maxDurationSeconds: 1020,
              pacing: 'balanced',
              language: 'zh-CN',
              instruction: '',
            },
            step: { key: 'plan_episodes' },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-bible', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'bible', targetPort: 'in' },
          { id: 'bible-episodes', sourceNodeId: 'bible', sourcePort: 'out', targetNodeId: 'episodes', targetPort: 'in' },
          { id: 'episodes-output', sourceNodeId: 'episodes', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.publishedWorkflowSteps).toEqual([
      expect.objectContaining({
        nodeId: 'bible',
        nodeType: WORKFLOW_NODE_TYPES.STORY_EXTRACT_BIBLE,
        stepKey: 'extract_bible',
        artifactTypes: ['production.prep.document'],
      }),
      expect.objectContaining({
        nodeId: 'episodes',
        nodeType: WORKFLOW_NODE_TYPES.STORY_PLAN_EPISODES,
        stepKey: 'plan_episodes',
        dependsOn: ['extract_bible'],
        artifactTypes: ['production.episode.plan'],
      }),
    ])
  })

  it('treats the dedicated runtime smoke node as the first executable published workflow step', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'smoke',
            type: WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
            title: 'Smoke check',
            step: { key: 'smoke_check' },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-smoke', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'smoke', targetPort: 'in' },
          { id: 'smoke-output', sourceNodeId: 'smoke', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.steps).toEqual([
      expect.objectContaining({
        nodeId: 'smoke',
        nodeType: WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
        nodeTitle: 'Smoke check',
        stepKey: 'smoke_check',
        retryable: false,
        artifactTypes: ['smoke.output'],
        supported: true,
        temporalStep: {
          stepKey: 'smoke_check',
          stepTitle: 'Smoke check',
          stepIndex: 1,
          stepTotal: 1,
          attempt: 1,
        },
      }),
    ])
    expect(() => assertPublishedWorkflowExecutionPlanExecutable(plan)).not.toThrow()
  })

  it('treats data transform as the first real business node Activity contract', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'smoke',
            type: WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
            config: { message: 'input text' },
            step: { key: 'smoke_check' },
          },
          {
            id: 'transform',
            type: WORKFLOW_NODE_TYPES.DATA_TRANSFORM,
            title: 'Render text',
            config: { mode: 'template', template: 'Result: {{ smoke_check.text }}' },
            step: { key: 'render_text' },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-smoke', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'smoke', targetPort: 'in' },
          { id: 'smoke-transform', sourceNodeId: 'smoke', sourcePort: 'out', targetNodeId: 'transform', targetPort: 'in' },
          { id: 'transform-output', sourceNodeId: 'transform', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.publishedWorkflowSteps).toEqual([
      expect.objectContaining({
        nodeId: 'smoke',
        nodeType: WORKFLOW_NODE_TYPES.RUNTIME_SMOKE,
        stepKey: 'smoke_check',
        dependsOn: [],
        config: { message: 'input text' },
      }),
      expect.objectContaining({
        nodeId: 'transform',
        nodeType: WORKFLOW_NODE_TYPES.DATA_TRANSFORM,
        stepKey: 'render_text',
        dependsOn: ['smoke_check'],
        config: { mode: 'template', template: 'Result: {{ smoke_check.text }}' },
      }),
    ])
  })

  it('treats user input as an executable published workflow input step', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'input',
            type: WORKFLOW_NODE_TYPES.USER_INPUT,
            title: 'Collect input',
            config: { prompt: 'Enter text', outputKey: 'user_text' },
            step: { key: 'collect_input' },
          },
          {
            id: 'transform',
            type: WORKFLOW_NODE_TYPES.DATA_TRANSFORM,
            title: 'Render text',
            config: { mode: 'template', template: 'Result: {{ collect_input.text }}' },
            step: { key: 'render_text' },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-input', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'input', targetPort: 'in' },
          { id: 'input-transform', sourceNodeId: 'input', sourcePort: 'out', targetNodeId: 'transform', targetPort: 'in' },
          { id: 'transform-output', sourceNodeId: 'transform', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.publishedWorkflowSteps).toEqual([
      expect.objectContaining({
        nodeId: 'input',
        nodeType: WORKFLOW_NODE_TYPES.USER_INPUT,
        stepKey: 'collect_input',
        dependsOn: [],
        config: { prompt: 'Enter text', outputKey: 'user_text' },
      }),
      expect.objectContaining({
        nodeId: 'transform',
        nodeType: WORKFLOW_NODE_TYPES.DATA_TRANSFORM,
        stepKey: 'render_text',
        dependsOn: ['collect_input'],
      }),
    ])
  })

  it('treats artifact persist as an executable side-effecting published workflow step', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          {
            id: 'input',
            type: WORKFLOW_NODE_TYPES.USER_INPUT,
            config: { prompt: 'Enter text', outputKey: 'user_text' },
            step: { key: 'collect_input' },
          },
          {
            id: 'persist',
            type: WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST,
            title: 'Persist output',
            config: { artifactType: 'workflow.output', refId: 'final' },
            step: { key: 'persist_output' },
          },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-input', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'input', targetPort: 'in' },
          { id: 'input-persist', sourceNodeId: 'input', sourcePort: 'out', targetNodeId: 'persist', targetPort: 'in' },
          { id: 'persist-output', sourceNodeId: 'persist', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.executable).toBe(true)
    expect(plan.diagnostics).toEqual([])
    expect(plan.publishedWorkflowSteps).toEqual([
      expect.objectContaining({
        nodeId: 'input',
        nodeType: WORKFLOW_NODE_TYPES.USER_INPUT,
        stepKey: 'collect_input',
        dependsOn: [],
      }),
      expect.objectContaining({
        nodeId: 'persist',
        nodeType: WORKFLOW_NODE_TYPES.ARTIFACT_PERSIST,
        stepKey: 'persist_output',
        dependsOn: ['collect_input'],
        config: { artifactType: 'workflow.output', refId: 'final' },
      }),
    ])
  })

  it('marks a trigger-to-output definition as an empty non-executable plan', () => {
    const plan = buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({
        nodes: [
          { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
          { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
        ],
        edges: [
          { id: 'trigger-output', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
        ],
      }),
    }))

    expect(plan.steps).toEqual([])
    expect(plan.executable).toBe(false)
    expect(plan.diagnostics).toEqual([
      expect.objectContaining({ code: 'WORKFLOW_EXECUTION_PLAN_EMPTY' }),
    ])
  })

  it('rejects invalid published definitions during compilation', () => {
    expect(() => buildPublishedWorkflowExecutionPlan(buildVersion({
      definition: buildCanvas({ edges: [] }),
    }))).toThrow('Invalid workflow canvas definition')
  })
})
