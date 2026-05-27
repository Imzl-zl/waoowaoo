import { describe, expect, it, vi } from 'vitest'
import { executePublishedWorkflowStepNode } from '@/lib/workflow-runtime/temporal/published-workflow-activities'
import type {
  TemporalPublishedWorkflowStep,
  TemporalPublishedWorkflowStepContext,
  TemporalWorkflowRunInput,
} from '@/lib/workflow-runtime/temporal/types'

const workflow: TemporalWorkflowRunInput = {
  runId: 'run-1',
  workflowType: 'custom.workflow',
  projectId: 'project-1',
  userId: 'user-1',
  targetType: 'WorkflowDefinitionVersion',
  targetId: 'version-1',
}

const workflowWithInput: TemporalWorkflowRunInput = {
  ...workflow,
  payload: {
    executionInput: {
      user_text: 'runtime text',
      structured: { count: 2 },
    },
  },
}

function step(overrides: Partial<TemporalPublishedWorkflowStep>): TemporalPublishedWorkflowStep {
  return {
    nodeId: 'step-1',
    nodeType: 'runtime.smoke',
    nodeTitle: 'Smoke',
    stepKey: 'smoke',
    dependsOn: [],
    config: { message: 'hello' },
    artifactTypes: ['smoke.output'],
    temporalStep: {
      stepKey: 'smoke',
      stepTitle: 'Smoke',
      stepIndex: 1,
      stepTotal: 1,
      attempt: 1,
    },
    ...overrides,
  }
}

describe('executePublishedWorkflowStepNode', () => {
  it('executes user input from the published workflow execution input', async () => {
    const result = await executePublishedWorkflowStepNode({
      workflow: workflowWithInput,
      step: step({
        nodeId: 'input',
        nodeType: 'input.user',
        nodeTitle: 'Collect input',
        stepKey: 'collect_input',
        config: { outputKey: 'user_text' },
        artifactTypes: ['input.value'],
      }),
      context: {},
      activityId: 'activity-input',
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'collect_input',
      nodeType: 'input.user',
      text: 'runtime text',
      artifactPayload: { user_text: 'runtime text' },
    }))
  })

  it('executes runtime smoke through the published step Activity contract', async () => {
    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({ nodeType: 'runtime.smoke', config: { message: 'hello' } }),
      context: {},
      activityId: 'activity-1',
    })

    expect(result).toEqual({
      stepKey: 'smoke',
      nodeId: 'step-1',
      nodeType: 'runtime.smoke',
      status: 'completed',
      activityId: 'activity-1',
      text: 'hello',
      artifactPayload: { message: 'hello' },
    })
  })

  it('maps dependency artifact payloads for data.transform map mode', async () => {
    const context: TemporalPublishedWorkflowStepContext = {
      collect_input: {
        stepKey: 'collect_input',
        nodeId: 'input',
        nodeType: 'runtime.smoke',
        status: 'completed',
        activityId: 'activity-input',
        text: 'raw text',
        artifactPayload: { text: 'raw text' },
      },
    }
    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'transform',
        nodeType: 'data.transform',
        nodeTitle: 'Map data',
        stepKey: 'map_data',
        dependsOn: ['collect_input'],
        config: { mode: 'map' },
      }),
      context,
      activityId: 'activity-map',
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'map_data',
      nodeType: 'data.transform',
      text: JSON.stringify({ collect_input: { text: 'raw text' } }),
      artifactPayload: { collect_input: { text: 'raw text' } },
    }))
  })

  it('renders dependency text in data.transform template mode', async () => {
    const context: TemporalPublishedWorkflowStepContext = {
      collect_input: {
        stepKey: 'collect_input',
        nodeId: 'input',
        nodeType: 'runtime.smoke',
        status: 'completed',
        activityId: 'activity-input',
        text: 'raw text',
        artifactPayload: { text: 'raw text' },
      },
    }
    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'transform',
        nodeType: 'data.transform',
        nodeTitle: 'Render data',
        stepKey: 'render_data',
        dependsOn: ['collect_input'],
        config: { mode: 'template', template: 'Value: {{ collect_input.text }}' },
      }),
      context,
      activityId: 'activity-template',
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'render_data',
      text: 'Value: raw text',
      artifactPayload: { text: 'Value: raw text' },
    }))
  })

  it('persists dependency artifacts through the run-runtime artifact boundary', async () => {
    const createWorkflowArtifact = async (input: {
      runId: string
      stepKey?: string | null
      artifactType: string
      refId: string
      versionHash?: string | null
      payload?: Record<string, unknown> | null
    }) => ({
      id: 'artifact-1',
      ...input,
      stepKey: input.stepKey || null,
      versionHash: input.versionHash || null,
      payload: input.payload || null,
      createdAt: '2026-05-27T00:00:00.000Z',
    })
    const context: TemporalPublishedWorkflowStepContext = {
      render_text: {
        stepKey: 'render_text',
        nodeId: 'transform',
        nodeType: 'data.transform',
        status: 'completed',
        activityId: 'activity-transform',
        text: 'final text',
        artifactPayload: { text: 'final text' },
      },
    }

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'persist',
        nodeType: 'artifact.persist',
        nodeTitle: 'Persist result',
        stepKey: 'persist_result',
        dependsOn: ['render_text'],
        config: { artifactType: 'workflow.output', refId: 'final' },
        artifactTypes: [],
      }),
      context,
      activityId: 'activity-persist',
      createWorkflowArtifact,
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'persist_result',
      nodeType: 'artifact.persist',
      text: 'Persisted workflow.output:final',
      artifactPayload: expect.objectContaining({
        artifactType: 'workflow.output',
        refId: 'final',
        dependencies: { render_text: { text: 'final text' } },
        persistedArtifact: expect.objectContaining({
          runId: 'run-1',
          stepKey: 'persist_result',
          artifactType: 'workflow.output',
          refId: 'final',
          payload: { render_text: { text: 'final text' } },
        }),
      }),
    }))
    expect((result.artifactPayload as { versionHash: string }).versionHash).toHaveLength(64)
  })

  it('executes LLM transform through model config, text billing, and the AI runtime boundary', async () => {
    const resolveModel = vi.fn(async () => 'provider::analysis-model')
    const executeText = vi.fn(async (_input: {
      messages: Array<{ role: string; content: string }>
    }) => ({
      text: 'rewritten text',
      reasoning: 'reasoning',
      usage: {
        promptTokens: 11,
        completionTokens: 7,
        totalTokens: 18,
      },
    }))
    const billText = vi.fn(async (input) => await input.execute())
    const createWorkflowArtifact = vi.fn(async (input) => ({
      id: 'artifact-llm',
      ...input,
      stepKey: input.stepKey || null,
      versionHash: input.versionHash || null,
      payload: input.payload || null,
      createdAt: '2026-05-27T00:00:00.000Z',
    }))
    const listWorkflowArtifacts = vi.fn(async () => [])
    const context: TemporalPublishedWorkflowStepContext = {
      collect_input: {
        stepKey: 'collect_input',
        nodeId: 'input',
        nodeType: 'input.user',
        status: 'completed',
        activityId: 'activity-input',
        text: 'raw input',
        artifactPayload: { user_text: 'raw input' },
      },
    }

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'llm-transform',
        nodeType: 'llm.transform',
        nodeTitle: 'Rewrite',
        stepKey: 'rewrite_text',
        dependsOn: ['collect_input'],
        config: {
          instruction: 'Rewrite the input',
          outputFormat: 'text',
          temperature: 0.2,
        },
        artifactTypes: ['text.output'],
      }),
      context,
      activityId: 'activity-llm',
      activity: { attempt: 2 },
      llm: { resolveModel, executeText, billText },
      createWorkflowArtifact,
      listWorkflowArtifacts,
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'rewrite_text',
      nodeType: 'llm.transform',
      text: 'rewritten text',
      artifactPayload: {
        text: 'rewritten text',
        reasoning: 'reasoning',
        usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
        model: 'provider::analysis-model',
      },
    }))
    expect(resolveModel).toHaveBeenCalledWith({
      workflow,
      step: expect.objectContaining({ stepKey: 'rewrite_text' }),
    })
    expect(billText).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      model: 'provider::analysis-model',
      projectId: 'project-1',
      action: 'published_workflow_llm_transform',
      billingKey: 'published-workflow:run-1:rewrite_text:attempt-2',
      maxOutputTokens: 1200,
      metadata: expect.objectContaining({
        nodeId: 'llm-transform',
        nodeType: 'llm.transform',
        stepKey: 'rewrite_text',
        activityAttempt: 2,
      }),
    }))
    expect(executeText).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      model: 'provider::analysis-model',
      projectId: 'project-1',
      action: 'published_workflow_llm_transform',
      temperature: 0.2,
      reasoning: true,
      reasoningEffort: 'medium',
      meta: {
        stepId: 'rewrite_text',
        stepAttempt: 1,
        stepTitle: 'Rewrite',
        stepIndex: 1,
        stepTotal: 1,
      },
    }))
    expect(executeText.mock.calls[0]?.[0]?.messages).toEqual([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('"user_text":"raw input"'),
      }),
    ])
    expect(createWorkflowArtifact).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      stepKey: 'rewrite_text',
      artifactType: 'workflow.llm.result',
      refId: 'rewrite_text',
      versionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      payload: { result },
    }))
  })

  it('executes LLM analysis as JSON and fails explicitly when model config is missing', async () => {
    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'analysis',
        nodeType: 'llm.analysis',
        nodeTitle: 'Analyze',
        stepKey: 'analyze_text',
        config: {
          instruction: 'Analyze input',
          outputFormat: 'json',
          temperature: 0.4,
        },
      }),
      context: {},
      activityId: 'activity-analysis',
      llm: {
        resolveModel: vi.fn(async () => 'provider::analysis-model'),
        billText: vi.fn(async (input) => await input.execute()),
        executeText: vi.fn(async () => ({
          text: '{"summary":"ok"}',
          reasoning: '',
          usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
        })),
      },
      createWorkflowArtifact: vi.fn(async (input) => ({ id: 'artifact-json', ...input, createdAt: '' })),
      listWorkflowArtifacts: vi.fn(async () => []),
    })

    expect(result.artifactPayload).toEqual(expect.objectContaining({
      text: '{"summary":"ok"}',
      json: { summary: 'ok' },
      model: 'provider::analysis-model',
    }))

    await expect(executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeType: 'llm.analysis',
        stepKey: 'missing_model',
        config: { instruction: 'Analyze', outputFormat: 'text' },
      }),
      context: {},
      activityId: 'activity-missing-model',
      llm: {
        resolveModel: vi.fn(async () => {
          throw new Error('published workflow LLM analysisModel is required')
        }),
      },
    })).rejects.toThrow('published workflow LLM analysisModel is required')
  })

  it('returns a cached LLM result before billing or provider execution', async () => {
    const cachedPayload = {
      result: {
        stepKey: 'rewrite_text',
        nodeId: 'llm-transform',
        nodeType: 'llm.transform',
        status: 'completed',
        activityId: 'previous-activity',
        text: 'cached text',
        artifactPayload: { text: 'cached text' },
      },
    }
    const billText = vi.fn()
    const executeText = vi.fn()

    const firstRunArtifacts: Array<{ versionHash?: string | null }> = []
    await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'llm-transform',
        nodeType: 'llm.transform',
        stepKey: 'rewrite_text',
        config: { instruction: 'Rewrite', outputFormat: 'text' },
      }),
      context: {},
      activityId: 'activity-first',
      llm: {
        resolveModel: vi.fn(async () => 'provider::analysis-model'),
        billText: vi.fn(async (input) => ({
          text: 'first text',
          reasoning: '',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          ...(await input.execute()),
        })),
        executeText: vi.fn(async () => ({
          text: 'first text',
          reasoning: '',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        })),
      },
      listWorkflowArtifacts: vi.fn(async () => []),
      createWorkflowArtifact: vi.fn(async (input) => {
        firstRunArtifacts.push(input)
        return { id: 'artifact-first', ...input, createdAt: '' }
      }),
    })
    const versionHash = firstRunArtifacts[0]?.versionHash

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'llm-transform',
        nodeType: 'llm.transform',
        stepKey: 'rewrite_text',
        config: { instruction: 'Rewrite', outputFormat: 'text' },
      }),
      context: {},
      activityId: 'activity-cached',
      llm: {
        resolveModel: vi.fn(async () => 'provider::analysis-model'),
        billText,
        executeText,
      },
      listWorkflowArtifacts: vi.fn(async () => [{
        id: 'artifact-cached',
        runId: 'run-1',
        stepKey: 'rewrite_text',
        artifactType: 'workflow.llm.result',
        refId: 'rewrite_text',
        versionHash: versionHash || null,
        payload: cachedPayload,
        createdAt: '2026-05-27T00:00:00.000Z',
      }]),
    })

    expect(result).toEqual({
      stepKey: 'rewrite_text',
      nodeId: 'llm-transform',
      nodeType: 'llm.transform',
      status: 'completed',
      activityId: 'activity-cached',
      text: 'cached text',
      artifactPayload: { text: 'cached text' },
    })
    expect(billText).not.toHaveBeenCalled()
    expect(executeText).not.toHaveBeenCalled()
  })

  it('executes production bible extraction through LLM and strict production schemas', async () => {
    const executeText = vi.fn(async (input: {
      messages: Array<{ role: string; content: string }>
    }) => ({
      text: JSON.stringify({
        schemaVersion: 1,
        sourceMode: 'novel',
        title: 'River Case',
        bible: { logline: 'A missing heir leaves one letter.' },
        assets: {
          characters: [{ id: 'char.lin', name: 'Lin' }],
          locations: [{ id: 'loc.market', name: 'River Market' }],
          props: [{ id: 'prop.letter', name: 'Wet letter' }],
          style: { visualStyle: 'grounded noir' },
        },
        episodePlans: [],
        sceneBreakdowns: [],
        shotPlans: [],
      }),
      reasoning: '',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }))
    const createWorkflowArtifact = vi.fn(async (input) => ({
      id: 'artifact-production',
      ...input,
      stepKey: input.stepKey || null,
      versionHash: input.versionHash || null,
      payload: input.payload || null,
      createdAt: '2026-05-27T00:00:00.000Z',
    }))

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'bible',
        nodeType: 'story.extractBible',
        nodeTitle: 'Extract bible',
        stepKey: 'extract_bible',
        config: { sourceMode: 'novel', language: 'zh-CN', instruction: 'Use cinematic detail.' },
        artifactTypes: ['production.prep.document'],
      }),
      context: {},
      activityId: 'activity-production',
      activity: { attempt: 1 },
      llm: {
        resolveModel: vi.fn(async () => 'provider::analysis-model'),
        billText: vi.fn(async (input) => await input.execute()),
        executeText,
      },
      createWorkflowArtifact,
      listWorkflowArtifacts: vi.fn(async () => []),
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'extract_bible',
      nodeType: 'story.extractBible',
      artifactPayload: expect.objectContaining({
        kind: 'production.prep.document',
        output: expect.objectContaining({
          schemaVersion: 1,
          sourceMode: 'novel',
          title: 'River Case',
          assets: expect.objectContaining({
            characters: [expect.objectContaining({ id: 'char.lin', name: 'Lin' })],
          }),
        }),
      }),
    }))
    expect(executeText.mock.calls[0]?.[0]?.messages[1]?.content).toContain('ProductionPrepDocument')
    expect(createWorkflowArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'workflow.llm.result',
      refId: 'extract_bible',
    }))
  })

  it('fails production planning explicitly when the LLM output does not match the schema', async () => {
    await expect(executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'episodes',
        nodeType: 'story.planEpisodes',
        nodeTitle: 'Plan episodes',
        stepKey: 'plan_episodes',
        config: {
          targetEpisodeCount: 1,
          targetDurationSeconds: 900,
          minDurationSeconds: 780,
          maxDurationSeconds: 1020,
          pacing: 'balanced',
          language: 'zh-CN',
        },
        artifactTypes: ['production.episode.plan'],
      }),
      context: {},
      activityId: 'activity-bad-production',
      llm: {
        resolveModel: vi.fn(async () => 'provider::analysis-model'),
        billText: vi.fn(async (input) => await input.execute()),
        executeText: vi.fn(async () => ({
          text: '{"episodePlans":[{"id":"ep.1"}]}',
          reasoning: '',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        })),
      },
      listWorkflowArtifacts: vi.fn(async () => []),
      createWorkflowArtifact: vi.fn(async (input) => ({ id: 'artifact-bad', ...input, createdAt: '' })),
    })).rejects.toThrow()
  })

  it('records human review checkpoints without pretending approval happened', async () => {
    const context: TemporalPublishedWorkflowStepContext = {
      extract_bible: {
        stepKey: 'extract_bible',
        nodeId: 'bible',
        nodeType: 'story.extractBible',
        status: 'completed',
        activityId: 'activity-bible',
        text: '{}',
        artifactPayload: { kind: 'production.prep.document', output: { title: 'River Case' } },
      },
    }

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'review',
        nodeType: 'human.review',
        nodeTitle: 'Review prep',
        stepKey: 'review_prep',
        dependsOn: ['extract_bible'],
        config: {
          checkpointName: 'prep-lock',
          required: true,
          instructions: 'Check continuity before media generation.',
        },
        artifactTypes: ['review.required'],
      }),
      context,
      activityId: 'activity-review',
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'review_prep',
      nodeType: 'human.review',
      artifactPayload: {
        checkpointName: 'prep-lock',
        required: true,
        instructions: 'Check continuity before media generation.',
        dependencies: {
          extract_bible: { kind: 'production.prep.document', output: { title: 'River Case' } },
        },
      },
    }))
  })

  it('executes image media generation through billing, provider, storage, and cache persistence', async () => {
    const resolveImageModel = vi.fn(async () => ({
      model: 'provider::image-model',
      modelSlot: 'storyboardModel' as const,
    }))
    const resolveImageOptions = vi.fn(async () => ({ resolution: '2K', aspectRatio: '16:9' }))
    const generateImage = vi.fn(async () => ({
      success: true,
      imageUrl: 'https://provider.example/image.png',
    }))
    const billImage = vi.fn(async (input) => await input.execute())
    const storeImage = vi.fn(async () => ({
      storageKey: 'images/workflow-media.png',
      mediaRef: {
        id: 'media-1',
        publicId: 'media-public-1',
        url: '/m/media-public-1',
        mimeType: 'image/png',
        sizeBytes: 100,
        width: null,
        height: null,
        durationMs: null,
        storageKey: 'images/workflow-media.png',
      },
    }))
    const createWorkflowArtifact = vi.fn(async (input) => ({
      id: 'artifact-media',
      ...input,
      stepKey: input.stepKey || null,
      versionHash: input.versionHash || null,
      payload: input.payload || null,
      createdAt: '2026-05-27T00:00:00.000Z',
    }))
    const listWorkflowArtifacts = vi.fn(async () => [])
    const context: TemporalPublishedWorkflowStepContext = {
      collect_input: {
        stepKey: 'collect_input',
        nodeId: 'input',
        nodeType: 'input.user',
        status: 'completed',
        activityId: 'activity-input',
        text: 'castle at sunrise',
        artifactPayload: { user_text: 'castle at sunrise' },
      },
    }

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'media',
        nodeType: 'media.generate',
        nodeTitle: 'Generate image',
        stepKey: 'generate_image',
        dependsOn: ['collect_input'],
        config: {
          prompt: 'Create a cinematic image',
          mediaKind: 'image',
          imageModelSlot: 'storyboardModel',
          aspectRatio: '16:9',
        },
        artifactTypes: ['media.output'],
      }),
      context,
      activityId: 'activity-media',
      activity: { attempt: 3 },
      media: {
        resolveImageModel,
        resolveImageOptions,
        generateImage,
        billImage,
        storeImage,
      },
      createWorkflowArtifact,
      listWorkflowArtifacts,
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'generate_image',
      nodeType: 'media.generate',
      text: '/m/media-public-1',
      artifactPayload: expect.objectContaining({
        mediaKind: 'image',
        model: 'provider::image-model',
        modelSlot: 'storyboardModel',
        storageKey: 'images/workflow-media.png',
        media: expect.objectContaining({ url: '/m/media-public-1' }),
      }),
    }))
    expect(resolveImageModel).toHaveBeenCalledWith({
      workflow,
      step: expect.objectContaining({ stepKey: 'generate_image' }),
    })
    expect(resolveImageOptions).toHaveBeenCalledWith({
      workflow,
      step: expect.objectContaining({ stepKey: 'generate_image' }),
      model: 'provider::image-model',
    })
    expect(billImage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      model: 'provider::image-model',
      count: 1,
      projectId: 'project-1',
      action: 'published_workflow_media_generate_image',
      billingKey: 'published-workflow:run-1:generate_image:attempt-3',
      metadata: expect.objectContaining({
        nodeId: 'media',
        nodeType: 'media.generate',
        stepKey: 'generate_image',
        mediaKind: 'image',
        modelSlot: 'storyboardModel',
        resolution: '2K',
        aspectRatio: '16:9',
      }),
    }))
    expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      model: 'provider::image-model',
      options: { resolution: '2K', aspectRatio: '16:9' },
      prompt: expect.stringContaining('castle at sunrise'),
    }))
    expect(storeImage).toHaveBeenCalledWith(expect.objectContaining({
      workflow,
      step: expect.objectContaining({ stepKey: 'generate_image' }),
      source: 'https://provider.example/image.png',
    }))
    expect(createWorkflowArtifact).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      stepKey: 'generate_image',
      artifactType: 'workflow.media.result',
      refId: 'generate_image',
      versionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      payload: { result },
    }))
  })

  it('returns cached media results before image billing or provider execution', async () => {
    const cachedPayload = {
      result: {
        stepKey: 'generate_image',
        nodeId: 'media',
        nodeType: 'media.generate',
        status: 'completed',
        activityId: 'previous-activity',
        text: '/m/cached',
        artifactPayload: { mediaKind: 'image', media: { url: '/m/cached' } },
      },
    }
    const firstRunArtifacts: Array<{ versionHash?: string | null }> = []
    await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'media',
        nodeType: 'media.generate',
        stepKey: 'generate_image',
        config: { prompt: 'Image', mediaKind: 'image', imageModelSlot: 'storyboardModel' },
      }),
      context: {},
      activityId: 'activity-first',
      media: {
        resolveImageModel: vi.fn(async () => ({ model: 'provider::image-model', modelSlot: 'storyboardModel' as const })),
        resolveImageOptions: vi.fn(async () => ({})),
        billImage: vi.fn(async (input) => await input.execute()),
        generateImage: vi.fn(async () => ({ success: true, imageUrl: 'https://provider.example/image.png' })),
        storeImage: vi.fn(async () => ({
          storageKey: 'images/first.png',
          mediaRef: {
            id: 'media-first',
            publicId: 'media-first',
            url: '/m/media-first',
            mimeType: 'image/png',
            sizeBytes: null,
            width: null,
            height: null,
            durationMs: null,
          },
        })),
      },
      listWorkflowArtifacts: vi.fn(async () => []),
      createWorkflowArtifact: vi.fn(async (input) => {
        firstRunArtifacts.push(input)
        return { id: 'artifact-first-media', ...input, createdAt: '' }
      }),
    })
    const versionHash = firstRunArtifacts[0]?.versionHash
    const billImage = vi.fn()
    const generateImage = vi.fn()

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'media',
        nodeType: 'media.generate',
        stepKey: 'generate_image',
        config: { prompt: 'Image', mediaKind: 'image', imageModelSlot: 'storyboardModel' },
      }),
      context: {},
      activityId: 'activity-cached-media',
      media: {
        resolveImageModel: vi.fn(async () => ({ model: 'provider::image-model', modelSlot: 'storyboardModel' as const })),
        resolveImageOptions: vi.fn(async () => ({})),
        billImage,
        generateImage,
      },
      listWorkflowArtifacts: vi.fn(async () => [{
        id: 'artifact-cached-media',
        runId: 'run-1',
        stepKey: 'generate_image',
        artifactType: 'workflow.media.result',
        refId: 'generate_image',
        versionHash: versionHash || null,
        payload: cachedPayload,
        createdAt: '2026-05-27T00:00:00.000Z',
      }]),
    })

    expect(result).toEqual({
      stepKey: 'generate_image',
      nodeId: 'media',
      nodeType: 'media.generate',
      status: 'completed',
      activityId: 'activity-cached-media',
      text: '/m/cached',
      artifactPayload: { mediaKind: 'image', media: { url: '/m/cached' } },
    })
    expect(billImage).not.toHaveBeenCalled()
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('checkpoints async image media external jobs and resumes polling without provider re-submit', async () => {
    const externalJobArtifacts: Array<{
      versionHash?: string | null
      payload?: Record<string, unknown> | null
    }> = []
    const createWorkflowArtifact = vi.fn(async (input) => {
      if (input.artifactType === 'workflow.media.external-job') {
        externalJobArtifacts.push(input)
      }
      return { id: `artifact-${input.artifactType}`, ...input, createdAt: '' }
    })
    const generateImage = vi.fn(async () => ({
      success: true,
      async: true,
      externalId: 'FAL:IMAGE:fal-ai/nano-banana-pro:req-1',
    }))
    const pollExternalJob = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({
        status: 'completed',
        imageUrl: 'https://provider.example/async-image.png',
      })
    const billImage = vi.fn(async (input) => await input.execute())
    const storeImage = vi.fn(async () => ({
      storageKey: 'images/async.png',
      mediaRef: {
        id: 'media-async',
        publicId: 'media-async',
        url: '/m/media-async',
        mimeType: 'image/png',
        sizeBytes: null,
        width: null,
        height: null,
        durationMs: null,
      },
    }))
    const asyncStep = step({
      nodeId: 'media',
      nodeType: 'media.generate',
      stepKey: 'generate_image',
      config: { prompt: 'Image', mediaKind: 'image', imageModelSlot: 'storyboardModel' },
    })

    await expect(executePublishedWorkflowStepNode({
      workflow,
      step: asyncStep,
      context: {},
      activityId: 'activity-async-first',
      media: {
        resolveImageModel: vi.fn(async () => ({ model: 'provider::image-model', modelSlot: 'storyboardModel' as const })),
        resolveImageOptions: vi.fn(async () => ({})),
        billImage,
        generateImage,
        pollExternalJob,
        storeImage,
      },
      listWorkflowArtifacts: vi.fn(async () => []),
      createWorkflowArtifact,
    })).rejects.toThrow('published workflow media external job pending: FAL:IMAGE:fal-ai/nano-banana-pro:req-1')

    const versionHash = externalJobArtifacts[0]?.versionHash
    expect(versionHash).toMatch(/^[a-f0-9]{64}$/)
    expect(createWorkflowArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'workflow.media.external-job',
      refId: 'generate_image',
      payload: {
        mediaKind: 'image',
        externalId: 'FAL:IMAGE:fal-ai/nano-banana-pro:req-1',
      },
    }))

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: asyncStep,
      context: {},
      activityId: 'activity-async-resume',
      media: {
        resolveImageModel: vi.fn(async () => ({ model: 'provider::image-model', modelSlot: 'storyboardModel' as const })),
        resolveImageOptions: vi.fn(async () => ({})),
        billImage,
        generateImage,
        pollExternalJob,
        storeImage,
      },
      listWorkflowArtifacts: vi.fn(async (input) => {
        if (input.artifactType !== 'workflow.media.external-job') return []
        return [{
          id: 'artifact-external-job',
          runId: 'run-1',
          stepKey: 'generate_image',
          artifactType: 'workflow.media.external-job',
          refId: 'generate_image',
          versionHash: versionHash || null,
          payload: externalJobArtifacts[0]?.payload || null,
          createdAt: '2026-05-27T00:00:00.000Z',
        }]
      }),
      createWorkflowArtifact,
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'generate_image',
      text: '/m/media-async',
      artifactPayload: expect.objectContaining({
        mediaKind: 'image',
        storageKey: 'images/async.png',
      }),
    }))
    expect(generateImage).toHaveBeenCalledTimes(1)
    expect(pollExternalJob).toHaveBeenCalledTimes(2)
    expect(pollExternalJob).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      externalId: 'FAL:IMAGE:fal-ai/nano-banana-pro:req-1',
    })
    expect(storeImage).toHaveBeenCalledWith(expect.objectContaining({
      source: 'https://provider.example/async-image.png',
    }))
  })

  it('executes video media generation from a direct image media dependency', async () => {
    const resolveVideoModel = vi.fn(async () => ({
      model: 'provider::video-model',
      modelSlot: 'videoModel' as const,
    }))
    const resolveVideoOptions = vi.fn(async () => ({
      duration: 5,
      resolution: '720p',
      generationMode: 'normal',
      generateAudio: false,
    }))
    const resolveVideoSourceImage = vi.fn(async () => ({
      imageUrl: 'data:image/png;base64,source',
      sourceStepKey: 'generate_image',
      storageKey: 'images/source.png',
    }))
    const generateVideo = vi.fn(async () => ({
      success: true,
      videoUrl: 'https://provider.example/video.mp4',
    }))
    const billVideo = vi.fn(async (input) => await input.execute())
    const storeVideo = vi.fn(async () => ({
      storageKey: 'video/workflow-media.mp4',
      mediaRef: {
        id: 'video-1',
        publicId: 'video-public-1',
        url: '/m/video-public-1',
        mimeType: 'video/mp4',
        sizeBytes: 1000,
        width: null,
        height: null,
        durationMs: null,
        storageKey: 'video/workflow-media.mp4',
      },
    }))
    const createWorkflowArtifact = vi.fn(async (input) => ({
      id: 'artifact-video',
      ...input,
      stepKey: input.stepKey || null,
      versionHash: input.versionHash || null,
      payload: input.payload || null,
      createdAt: '2026-05-27T00:00:00.000Z',
    }))
    const context: TemporalPublishedWorkflowStepContext = {
      generate_image: {
        stepKey: 'generate_image',
        nodeId: 'image',
        nodeType: 'media.generate',
        status: 'completed',
        activityId: 'activity-image',
        text: '/m/image-public',
        artifactPayload: {
          mediaKind: 'image',
          storageKey: 'images/source.png',
          media: { url: '/m/image-public', storageKey: 'images/source.png' },
        },
      },
    }

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'video',
        nodeType: 'media.generate',
        nodeTitle: 'Generate video',
        stepKey: 'generate_video',
        dependsOn: ['generate_image'],
        config: {
          prompt: 'Animate this frame',
          mediaKind: 'video',
          videoDuration: 5,
          videoResolution: '720p',
          generateAudio: false,
        },
      }),
      context,
      activityId: 'activity-video',
      activity: { attempt: 2 },
      media: {
        resolveVideoModel,
        resolveVideoOptions,
        resolveVideoSourceImage,
        generateVideo,
        billVideo,
        storeVideo,
      },
      createWorkflowArtifact,
      listWorkflowArtifacts: vi.fn(async () => []),
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'generate_video',
      nodeType: 'media.generate',
      text: '/m/video-public-1',
      artifactPayload: expect.objectContaining({
        mediaKind: 'video',
        model: 'provider::video-model',
        modelSlot: 'videoModel',
        sourceStepKey: 'generate_image',
        sourceStorageKey: 'images/source.png',
        storageKey: 'video/workflow-media.mp4',
      }),
    }))
    expect(billVideo).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      model: 'provider::video-model',
      resolution: '720p',
      maxCount: 1,
      projectId: 'project-1',
      action: 'published_workflow_media_generate_video',
      billingKey: 'published-workflow:run-1:generate_video:attempt-2',
      metadata: expect.objectContaining({
        nodeId: 'video',
        nodeType: 'media.generate',
        mediaKind: 'video',
        sourceStepKey: 'generate_image',
        sourceStorageKey: 'images/source.png',
        duration: 5,
        resolution: '720p',
      }),
    }))
    expect(generateVideo).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      model: 'provider::video-model',
      imageUrl: 'data:image/png;base64,source',
      prompt: expect.stringContaining('Animate this frame'),
      options: {
        duration: 5,
        resolution: '720p',
        generationMode: 'normal',
        generateAudio: false,
      },
    }))
    expect(storeVideo).toHaveBeenCalledWith(expect.objectContaining({
      source: 'https://provider.example/video.mp4',
    }))
    expect(createWorkflowArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'workflow.media.result',
      refId: 'generate_video',
      payload: { result },
    }))
  })

  it('checkpoints async video media external jobs and resumes polling without provider re-submit', async () => {
    const externalJobArtifacts: Array<{
      versionHash?: string | null
      payload?: Record<string, unknown> | null
    }> = []
    const createWorkflowArtifact = vi.fn(async (input) => {
      if (input.artifactType === 'workflow.media.external-job') {
        externalJobArtifacts.push(input)
      }
      return { id: `artifact-${input.artifactType}`, ...input, createdAt: '' }
    })
    const generateVideo = vi.fn(async () => ({
      success: true,
      async: true,
      externalId: 'FAL:VIDEO:fal-ai/video:req-1',
    }))
    const pollExternalJob = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({
        status: 'completed',
        videoUrl: 'https://provider.example/async-video.mp4',
        actualVideoTokens: 120_000,
        downloadHeaders: { Authorization: 'Bearer token' },
      })
    const billVideo = vi.fn(async (input) => await input.execute())
    const storeVideo = vi.fn(async () => ({
      storageKey: 'video/async.mp4',
      mediaRef: {
        id: 'video-async',
        publicId: 'video-async',
        url: '/m/video-async',
        mimeType: 'video/mp4',
        sizeBytes: null,
        width: null,
        height: null,
        durationMs: null,
      },
    }))
    const asyncStep = step({
      nodeId: 'video',
      nodeType: 'media.generate',
      stepKey: 'generate_video',
      dependsOn: ['generate_image'],
      config: {
        prompt: 'Video',
        mediaKind: 'video',
        videoDuration: 5,
        videoResolution: '720p',
      },
    })
    const context: TemporalPublishedWorkflowStepContext = {
      generate_image: {
        stepKey: 'generate_image',
        nodeId: 'image',
        nodeType: 'media.generate',
        status: 'completed',
        activityId: 'activity-image',
        text: '/m/image-public',
        artifactPayload: {
          mediaKind: 'image',
          storageKey: 'images/source.png',
          media: { url: '/m/image-public', storageKey: 'images/source.png' },
        },
      },
    }
    const media = {
      resolveVideoModel: vi.fn(async () => ({ model: 'provider::video-model', modelSlot: 'videoModel' as const })),
      resolveVideoOptions: vi.fn(async () => ({ duration: 5, resolution: '720p', generationMode: 'normal' })),
      resolveVideoSourceImage: vi.fn(async () => ({
        imageUrl: 'data:image/png;base64,source',
        sourceStepKey: 'generate_image',
        storageKey: 'images/source.png',
      })),
      billVideo,
      generateVideo,
      pollExternalJob,
      storeVideo,
    }

    await expect(executePublishedWorkflowStepNode({
      workflow,
      step: asyncStep,
      context,
      activityId: 'activity-video-first',
      media,
      listWorkflowArtifacts: vi.fn(async () => []),
      createWorkflowArtifact,
    })).rejects.toThrow('published workflow media external job pending: FAL:VIDEO:fal-ai/video:req-1')

    const versionHash = externalJobArtifacts[0]?.versionHash
    expect(versionHash).toMatch(/^[a-f0-9]{64}$/)
    expect(createWorkflowArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'workflow.media.external-job',
      refId: 'generate_video',
      payload: {
        mediaKind: 'video',
        externalId: 'FAL:VIDEO:fal-ai/video:req-1',
      },
    }))

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: asyncStep,
      context,
      activityId: 'activity-video-resume',
      media,
      listWorkflowArtifacts: vi.fn(async (input) => {
        if (input.artifactType !== 'workflow.media.external-job') return []
        return [{
          id: 'artifact-video-external-job',
          runId: 'run-1',
          stepKey: 'generate_video',
          artifactType: 'workflow.media.external-job',
          refId: 'generate_video',
          versionHash: versionHash || null,
          payload: externalJobArtifacts[0]?.payload || null,
          createdAt: '2026-05-27T00:00:00.000Z',
        }]
      }),
      createWorkflowArtifact,
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'generate_video',
      text: '/m/video-async',
      artifactPayload: expect.objectContaining({
        mediaKind: 'video',
        storageKey: 'video/async.mp4',
        actualVideoTokens: 120_000,
      }),
    }))
    expect(generateVideo).toHaveBeenCalledTimes(1)
    expect(pollExternalJob).toHaveBeenCalledTimes(2)
    expect(storeVideo).toHaveBeenCalledWith(expect.objectContaining({
      source: 'https://provider.example/async-video.mp4',
      downloadHeaders: { Authorization: 'Bearer token' },
    }))
    expect(billVideo).toHaveBeenLastCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        sourceStepKey: 'generate_image',
      }),
    }))
  })

  it('executes audio media generation through TTS billing, provider, storage, and cache persistence', async () => {
    const resolveAudioModel = vi.fn(async () => ({
      model: 'provider::audio-model',
      modelSlot: 'audioModel' as const,
    }))
    const resolveAudioOptions = vi.fn(async () => ({
      voice: 'voice-1',
      rate: 1.1,
      maxFreezeSeconds: 30,
    }))
    const generateAudio = vi.fn(async () => ({
      success: true,
      audioUrl: 'https://provider.example/audio.mp3',
      actualDurationSeconds: 12,
    }))
    const billAudio = vi.fn(async (input) => await input.execute())
    const storeAudio = vi.fn(async () => ({
      storageKey: 'audio/workflow-media.mp3',
      mediaRef: {
        id: 'audio-1',
        publicId: 'audio-public-1',
        url: '/m/audio-public-1',
        mimeType: 'audio/mpeg',
        sizeBytes: 900,
        width: null,
        height: null,
        durationMs: 12000,
        storageKey: 'audio/workflow-media.mp3',
      },
    }))
    const createWorkflowArtifact = vi.fn(async (input) => ({
      id: 'artifact-audio',
      ...input,
      stepKey: input.stepKey || null,
      versionHash: input.versionHash || null,
      payload: input.payload || null,
      createdAt: '2026-05-27T00:00:00.000Z',
    }))
    const context: TemporalPublishedWorkflowStepContext = {
      render_text: {
        stepKey: 'render_text',
        nodeId: 'transform',
        nodeType: 'data.transform',
        status: 'completed',
        activityId: 'activity-transform',
        text: 'line text',
        artifactPayload: { text: 'line text' },
      },
    }

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeId: 'audio',
        nodeType: 'media.generate',
        nodeTitle: 'Generate audio',
        stepKey: 'generate_audio',
        dependsOn: ['render_text'],
        config: {
          prompt: 'Narrate the line',
          mediaKind: 'audio',
          audioVoice: 'voice-1',
          audioRate: 1.1,
          audioMaxFreezeSeconds: 30,
        },
      }),
      context,
      activityId: 'activity-audio',
      activity: { attempt: 4 },
      media: {
        resolveAudioModel,
        resolveAudioOptions,
        generateAudio,
        billAudio,
        storeAudio,
      },
      createWorkflowArtifact,
      listWorkflowArtifacts: vi.fn(async () => []),
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'generate_audio',
      nodeType: 'media.generate',
      text: '/m/audio-public-1',
      artifactPayload: expect.objectContaining({
        mediaKind: 'audio',
        model: 'provider::audio-model',
        modelSlot: 'audioModel',
        text: expect.stringContaining('line text'),
        voice: 'voice-1',
        rate: 1.1,
        maxFreezeSeconds: 30,
        storageKey: 'audio/workflow-media.mp3',
        actualDurationSeconds: 12,
        media: expect.objectContaining({ url: '/m/audio-public-1' }),
      }),
    }))
    expect(resolveAudioOptions).toHaveBeenCalledWith(expect.objectContaining({
      workflow,
      step: expect.objectContaining({ stepKey: 'generate_audio' }),
      model: 'provider::audio-model',
      renderedText: expect.stringContaining('line text'),
    }))
    expect(billAudio).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      model: 'provider::audio-model',
      maxFreezeSeconds: 30,
      projectId: 'project-1',
      action: 'published_workflow_media_generate_audio',
      billingKey: 'published-workflow:run-1:generate_audio:attempt-4',
      metadata: expect.objectContaining({
        nodeId: 'audio',
        nodeType: 'media.generate',
        mediaKind: 'audio',
        modelSlot: 'audioModel',
        voice: 'voice-1',
        rate: 1.1,
        maxFreezeSeconds: 30,
      }),
    }))
    expect(generateAudio).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      model: 'provider::audio-model',
      text: expect.stringContaining('line text'),
      options: { voice: 'voice-1', rate: 1.1, maxFreezeSeconds: 30 },
    }))
    expect(storeAudio).toHaveBeenCalledWith(expect.objectContaining({
      source: 'https://provider.example/audio.mp3',
    }))
    expect(createWorkflowArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'workflow.media.result',
      refId: 'generate_audio',
      payload: { result },
    }))
  })

  it('checkpoints async audio media external jobs and resumes polling without provider re-submit', async () => {
    const externalJobArtifacts: Array<{
      versionHash?: string | null
      payload?: Record<string, unknown> | null
    }> = []
    const createWorkflowArtifact = vi.fn(async (input) => {
      if (input.artifactType === 'workflow.media.external-job') {
        externalJobArtifacts.push(input)
      }
      return { id: `artifact-${input.artifactType}`, ...input, createdAt: '' }
    })
    const generateAudio = vi.fn(async () => ({
      success: true,
      async: true,
      externalId: 'FAL:AUDIO:fal-ai/tts:req-1',
    }))
    const pollExternalJob = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({
        status: 'completed',
        audioUrl: 'https://provider.example/async-audio.mp3',
        actualDurationSeconds: 18,
        downloadHeaders: { Authorization: 'Bearer token' },
      })
    const billAudio = vi.fn(async (input) => await input.execute())
    const storeAudio = vi.fn(async () => ({
      storageKey: 'audio/async.mp3',
      mediaRef: {
        id: 'audio-async',
        publicId: 'audio-async',
        url: '/m/audio-async',
        mimeType: 'audio/mpeg',
        sizeBytes: null,
        width: null,
        height: null,
        durationMs: null,
      },
    }))
    const asyncStep = step({
      nodeId: 'audio',
      nodeType: 'media.generate',
      stepKey: 'generate_audio',
      config: {
        prompt: 'Narrate',
        mediaKind: 'audio',
        audioVoice: 'voice-1',
        audioRate: 1,
        audioMaxFreezeSeconds: 30,
      },
    })
    const media = {
      resolveAudioModel: vi.fn(async () => ({ model: 'provider::audio-model', modelSlot: 'audioModel' as const })),
      resolveAudioOptions: vi.fn(async () => ({ voice: 'voice-1', rate: 1, maxFreezeSeconds: 30 })),
      billAudio,
      generateAudio,
      pollExternalJob,
      storeAudio,
    }

    await expect(executePublishedWorkflowStepNode({
      workflow,
      step: asyncStep,
      context: {},
      activityId: 'activity-audio-first',
      media,
      listWorkflowArtifacts: vi.fn(async () => []),
      createWorkflowArtifact,
    })).rejects.toThrow('published workflow media external job pending: FAL:AUDIO:fal-ai/tts:req-1')

    const versionHash = externalJobArtifacts[0]?.versionHash
    expect(versionHash).toMatch(/^[a-f0-9]{64}$/)
    expect(createWorkflowArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'workflow.media.external-job',
      refId: 'generate_audio',
      payload: {
        mediaKind: 'audio',
        externalId: 'FAL:AUDIO:fal-ai/tts:req-1',
      },
    }))

    const result = await executePublishedWorkflowStepNode({
      workflow,
      step: asyncStep,
      context: {},
      activityId: 'activity-audio-resume',
      media,
      listWorkflowArtifacts: vi.fn(async (input) => {
        if (input.artifactType !== 'workflow.media.external-job') return []
        return [{
          id: 'artifact-audio-external-job',
          runId: 'run-1',
          stepKey: 'generate_audio',
          artifactType: 'workflow.media.external-job',
          refId: 'generate_audio',
          versionHash: versionHash || null,
          payload: externalJobArtifacts[0]?.payload || null,
          createdAt: '2026-05-27T00:00:00.000Z',
        }]
      }),
      createWorkflowArtifact,
    })

    expect(result).toEqual(expect.objectContaining({
      stepKey: 'generate_audio',
      text: '/m/audio-async',
      artifactPayload: expect.objectContaining({
        mediaKind: 'audio',
        storageKey: 'audio/async.mp3',
        actualDurationSeconds: 18,
      }),
    }))
    expect(generateAudio).toHaveBeenCalledTimes(1)
    expect(pollExternalJob).toHaveBeenCalledTimes(2)
    expect(storeAudio).toHaveBeenCalledWith(expect.objectContaining({
      source: 'https://provider.example/async-audio.mp3',
      downloadHeaders: { Authorization: 'Bearer token' },
    }))
  })

  it('fails explicitly for unsupported nodes and missing dependencies', async () => {
    expect(() => executePublishedWorkflowStepNode({
      workflow,
      step: step({ nodeType: 'media.generate' }),
      context: {},
      activityId: 'activity-unsupported',
    })).toThrow('unsupported published workflow node config: media.generate currently supports image, video, and audio only; received missing mediaKind')

    await expect(executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeType: 'media.generate',
        stepKey: 'generate_video',
        dependsOn: [],
        config: {
          prompt: 'Video',
          mediaKind: 'video',
          videoDuration: 5,
          videoResolution: '720p',
        },
      }),
      context: {},
      activityId: 'activity-video-missing-source',
      media: {
        resolveVideoModel: vi.fn(async () => ({ model: 'provider::video-model', modelSlot: 'videoModel' as const })),
        resolveVideoOptions: vi.fn(async () => ({ duration: 5, resolution: '720p', generationMode: 'normal' })),
        billVideo: vi.fn(async (input) => await input.execute()),
      },
      listWorkflowArtifacts: vi.fn(async () => []),
    })).rejects.toThrow('published workflow media.generate video step generate_video requires one direct image media dependency')

    await expect(executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeType: 'media.generate',
        config: { prompt: 'Image', mediaKind: 'image', imageModelSlot: 'storyboardModel' },
      }),
      context: {},
      activityId: 'activity-media-async',
      media: {
        resolveImageModel: vi.fn(async () => ({ model: 'provider::image-model', modelSlot: 'storyboardModel' as const })),
        resolveImageOptions: vi.fn(async () => ({})),
        billImage: vi.fn(async (input) => await input.execute()),
        generateImage: vi.fn(async () => ({ success: true, async: true })),
      },
      listWorkflowArtifacts: vi.fn(async () => []),
    })).rejects.toThrow('published workflow media.generate image async result returned no externalId')

    expect(() => executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeType: 'input.user',
        stepKey: 'collect_input',
        config: { outputKey: 'missing_input' },
      }),
      context: {},
      activityId: 'activity-input',
    })).toThrow('published workflow execution input missing_input is required')

    expect(() => executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeType: 'data.transform',
        stepKey: 'map_data',
        dependsOn: ['missing_step'],
        config: { mode: 'map' },
      }),
      context: {},
      activityId: 'activity-missing',
    })).toThrow('published workflow dependency missing_step is missing for step map_data')

    await expect(executePublishedWorkflowStepNode({
      workflow,
      step: step({
        nodeType: 'artifact.persist',
        stepKey: 'persist_result',
        dependsOn: [],
        config: { artifactType: 'workflow.output', refId: 'final' },
      }),
      context: {},
      activityId: 'activity-persist',
    })).rejects.toThrow('published workflow artifact.persist step persist_result requires at least one dependency')
  })
})
