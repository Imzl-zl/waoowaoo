import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-errors'
import { RUN_EVENT_TYPE } from '@/lib/run-runtime/types'
import type { PublishedWorkflowExecutionPlan } from '@/lib/workflow-engine/execution-plan-types'
import { executeProjectPublishedWorkflowDefinition } from '@/lib/workflow-engine/published-workflow-execution'
import { TEMPORAL_WORKFLOW_TYPE, type TemporalPublishedWorkflowStep } from '@/lib/workflow-runtime/temporal/types'

const temporalSteps = [
  {
    stepKey: 'smoke_check',
    stepTitle: 'Smoke check',
    stepIndex: 1,
    stepTotal: 1,
    attempt: 1,
  },
]

const publishedWorkflowSteps: TemporalPublishedWorkflowStep[] = [
  {
    nodeId: 'smoke',
    nodeType: 'runtime.smoke',
    nodeTitle: 'Smoke check',
    stepKey: 'smoke_check',
    dependsOn: [],
    config: { message: 'Smoke check' },
    artifactTypes: ['smoke.output'],
    temporalStep: temporalSteps[0],
  },
]

function buildPlan(overrides: Partial<PublishedWorkflowExecutionPlan> = {}): PublishedWorkflowExecutionPlan {
  return {
    workflowDefinitionId: 'definition-1',
    workflowDefinitionVersionId: 'version-1',
    workflowType: 'custom.workflow',
    title: 'Custom workflow',
    version: 3,
    executable: true,
    steps: [],
    temporalSteps,
    publishedWorkflowSteps,
    diagnostics: [],
    unsupportedNodes: [],
    ...overrides,
  }
}

function buildRun() {
  return {
    id: 'run-1',
    userId: 'user-1',
    projectId: 'project-1',
    workflowType: 'custom.workflow',
    targetType: 'WorkflowDefinitionVersion',
    targetId: 'version-1',
    status: 'queued',
  } as never
}

describe('published workflow execution', () => {
  it('creates a run and launches the published workflow through the dedicated Temporal runtime', async () => {
    const plan = buildPlan()
    const run = buildRun()
    const getExecutionPlan = vi.fn(async () => plan)
    const createWorkflowRun = vi.fn(async () => run)
    const launchWorkflow = vi.fn(async () => ({
      start: {
        runId: 'run-1',
        workflowType: 'custom.workflow',
        temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.PUBLISHED_WORKFLOW,
        workflowId: 'waoowaoo-run-run-1',
        firstExecutionRunId: 'temporal-run-1',
        taskQueue: 'waoowaoo-workflows',
      },
      recorded: { id: 'run-1' },
    }))
    const writeRunEvent = vi.fn()

    const result = await executeProjectPublishedWorkflowDefinition({
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
      executionInput: { user_text: 'runtime text' },
    }, {
      getExecutionPlan,
      createWorkflowRun,
      launchWorkflow,
      writeRunEvent,
    })

    expect(result.runId).toBe('run-1')
    expect(getExecutionPlan).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    })
    expect(createWorkflowRun).toHaveBeenCalledWith({
      userId: 'user-1',
      projectId: 'project-1',
      workflowType: 'custom.workflow',
      targetType: 'WorkflowDefinitionVersion',
      targetId: 'version-1',
      input: expect.objectContaining({
        workflowDefinitionId: 'definition-1',
        workflowDefinitionVersionId: 'version-1',
        workflowVersion: 3,
        executionInput: { user_text: 'runtime text' },
        temporalSteps,
        publishedWorkflowSteps,
      }),
    })
    expect(launchWorkflow).toHaveBeenCalledWith({
      temporalWorkflowType: TEMPORAL_WORKFLOW_TYPE.PUBLISHED_WORKFLOW,
      input: {
        runId: 'run-1',
        workflowType: 'custom.workflow',
        projectId: 'project-1',
        userId: 'user-1',
        targetType: 'WorkflowDefinitionVersion',
        targetId: 'version-1',
        payload: expect.objectContaining({
          workflowDefinitionId: 'definition-1',
          workflowDefinitionVersionId: 'version-1',
          workflowVersion: 3,
          executionInput: { user_text: 'runtime text' },
          temporalSteps,
          publishedWorkflowSteps,
        }),
      },
    })
    expect(writeRunEvent).not.toHaveBeenCalled()
  })

  it('refuses missing or non-executable published workflow plans', async () => {
    await expect(executeProjectPublishedWorkflowDefinition({
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'missing.workflow',
    }, {
      getExecutionPlan: vi.fn(async () => null),
    })).rejects.toMatchObject({ code: 'NOT_FOUND' } satisfies Pick<ApiError, 'code'>)

    await expect(executeProjectPublishedWorkflowDefinition({
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    }, {
      getExecutionPlan: vi.fn(async () => buildPlan({
        executable: false,
        diagnostics: [{
          code: 'WORKFLOW_NODE_RUNTIME_UNSUPPORTED',
          message: 'unsupported',
          nodeId: 'draft',
          nodeType: 'llm.transform',
          stepKey: 'draft',
        }],
        unsupportedNodes: [],
      })),
    })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    } satisfies Pick<ApiError, 'code'>)
  })

  it('rejects non-object published workflow execution input', async () => {
    await expect(executeProjectPublishedWorkflowDefinition({
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
      executionInput: ['invalid'],
    }, {
      getExecutionPlan: vi.fn(async () => buildPlan()),
    })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    } satisfies Pick<ApiError, 'code'>)
  })

  it('records a run error when Temporal launch fails after run creation', async () => {
    const plan = buildPlan()
    const run = buildRun()
    const launchError = new Error('temporal unavailable')
    const writeRunEvent = vi.fn(async () => undefined)

    await expect(executeProjectPublishedWorkflowDefinition({
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    }, {
      getExecutionPlan: vi.fn(async () => plan),
      createWorkflowRun: vi.fn(async () => run),
      launchWorkflow: vi.fn(async () => {
        throw launchError
      }),
      writeRunEvent,
    })).rejects.toBe(launchError)

    expect(writeRunEvent).toHaveBeenCalledWith({
      runId: 'run-1',
      projectId: 'project-1',
      userId: 'user-1',
      eventType: RUN_EVENT_TYPE.RUN_ERROR,
      idempotencyKey: 'published-workflow-launch-failed:run-1',
      payload: expect.objectContaining({
        errorCode: 'PUBLISHED_WORKFLOW_LAUNCH_FAILED',
        message: 'temporal unavailable',
        workflowDefinitionVersionId: 'version-1',
      }),
    })
  })
})
