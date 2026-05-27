import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authState = vi.hoisted(() => ({ authenticated: true }))
const storeMock = vi.hoisted(() => ({
  listProjectWorkflowDefinitions: vi.fn(),
  getProjectWorkflowDefinition: vi.fn(),
  saveProjectWorkflowDefinitionDraft: vi.fn(),
  publishProjectWorkflowDefinition: vi.fn(),
}))
const executeProjectPublishedWorkflowDefinitionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => {
  const unauthorized = () => new Response(
    JSON.stringify({ error: { code: 'UNAUTHORIZED' } }),
    { status: 401, headers: { 'content-type': 'application/json' } },
  )

  return {
    isErrorResponse: (value: unknown) => value instanceof Response,
    requireProjectAuthLight: async (projectId: string) => {
      if (!authState.authenticated) return unauthorized()
      return {
        session: { user: { id: 'user-1' } },
        project: { id: projectId, userId: 'user-1' },
      }
    },
  }
})

vi.mock('@/lib/workflow-engine/definition-store', () => storeMock)
vi.mock('@/lib/workflow-engine/published-workflow-execution', () => ({
  executeProjectPublishedWorkflowDefinition: executeProjectPublishedWorkflowDefinitionMock,
}))

const validDefinition = {
  schemaVersion: 1,
  workflowType: 'custom.workflow',
  title: 'Custom workflow',
  nodes: [
    { id: 'trigger', type: 'trigger.manual' },
    { id: 'output', type: 'output.result' },
  ],
  edges: [
    { id: 'trigger-output', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
  ],
}

describe('api contract - workflow definition routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.authenticated = true
    storeMock.listProjectWorkflowDefinitions.mockResolvedValue([{ workflowType: 'custom.workflow' }])
    storeMock.getProjectWorkflowDefinition.mockResolvedValue({ workflowType: 'custom.workflow' })
    storeMock.saveProjectWorkflowDefinitionDraft.mockResolvedValue({ workflowType: 'custom.workflow' })
    storeMock.publishProjectWorkflowDefinition.mockResolvedValue({
      definition: { workflowType: 'custom.workflow' },
      version: { version: 1 },
    })
    executeProjectPublishedWorkflowDefinitionMock.mockResolvedValue({
      runId: 'run-1',
      run: { id: 'run-1', status: 'queued' },
    })
  })

  it('GET /projects/[projectId]/workflows rejects unauthenticated requests', async () => {
    authState.authenticated = false
    const { GET } = await import('@/app/api/projects/[projectId]/workflows/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1/workflows',
      method: 'GET',
    })

    const res = await GET(req, { params: Promise.resolve({ projectId: 'project-1' }) })

    expect(res.status).toBe(401)
    expect(storeMock.listProjectWorkflowDefinitions).not.toHaveBeenCalled()
  })

  it('lists project workflow definitions through the service layer', async () => {
    const { GET } = await import('@/app/api/projects/[projectId]/workflows/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1/workflows',
      method: 'GET',
    })

    const res = await GET(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    const payload = await res.json() as { workflowDefinitions: unknown[] }

    expect(res.status).toBe(200)
    expect(payload.workflowDefinitions).toHaveLength(1)
    expect(storeMock.listProjectWorkflowDefinitions).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'user-1',
    })
  })

  it('saves a project workflow draft from POST and PUT routes', async () => {
    const collectionRoute = await import('@/app/api/projects/[projectId]/workflows/route')
    const itemRoute = await import('@/app/api/projects/[projectId]/workflows/[workflowType]/route')
    const collectionReq = buildMockRequest({
      path: '/api/projects/project-1/workflows',
      method: 'POST',
      body: { definition: validDefinition },
    })
    const itemReq = buildMockRequest({
      path: '/api/projects/project-1/workflows/custom.workflow',
      method: 'PUT',
      body: { definition: validDefinition },
    })

    expect((await collectionRoute.POST(collectionReq, {
      params: Promise.resolve({ projectId: 'project-1' }),
    })).status).toBe(200)
    expect((await itemRoute.PUT(itemReq, {
      params: Promise.resolve({ projectId: 'project-1', workflowType: 'custom.workflow' }),
    })).status).toBe(200)

    expect(storeMock.saveProjectWorkflowDefinitionDraft).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      userId: 'user-1',
      definition: validDefinition,
    }))
    expect(storeMock.saveProjectWorkflowDefinitionDraft).toHaveBeenCalledWith(expect.objectContaining({
      workflowType: 'custom.workflow',
    }))
  })

  it('reads and publishes a project workflow definition', async () => {
    const itemRoute = await import('@/app/api/projects/[projectId]/workflows/[workflowType]/route')
    const publishRoute = await import('@/app/api/projects/[projectId]/workflows/[workflowType]/publish/route')
    const getReq = buildMockRequest({
      path: '/api/projects/project-1/workflows/custom.workflow',
      method: 'GET',
    })
    const publishReq = buildMockRequest({
      path: '/api/projects/project-1/workflows/custom.workflow/publish',
      method: 'POST',
    })

    const getRes = await itemRoute.GET(getReq, {
      params: Promise.resolve({ projectId: 'project-1', workflowType: 'custom.workflow' }),
    })
    const publishRes = await publishRoute.POST(publishReq, {
      params: Promise.resolve({ projectId: 'project-1', workflowType: 'custom.workflow' }),
    })

    expect(getRes.status).toBe(200)
    expect(publishRes.status).toBe(200)
    expect(storeMock.getProjectWorkflowDefinition).toHaveBeenCalledWith({
      projectId: 'project-1',
      workflowType: 'custom.workflow',
      userId: 'user-1',
    })
    expect(storeMock.publishProjectWorkflowDefinition).toHaveBeenCalledWith({
      projectId: 'project-1',
      workflowType: 'custom.workflow',
      userId: 'user-1',
    })
  })

  it('executes a published project workflow definition through the service layer', async () => {
    const executeRoute = await import('@/app/api/projects/[projectId]/workflows/[workflowType]/execute/route')
    const executeReq = buildMockRequest({
      path: '/api/projects/project-1/workflows/custom.workflow/execute',
      method: 'POST',
      body: { user_text: 'runtime text' },
    })

    const res = await executeRoute.POST(executeReq, {
      params: Promise.resolve({ projectId: 'project-1', workflowType: 'custom.workflow' }),
    })
    const payload = await res.json() as { runId: string }

    expect(res.status).toBe(200)
    expect(payload.runId).toBe('run-1')
    expect(executeProjectPublishedWorkflowDefinitionMock).toHaveBeenCalledWith({
      projectId: 'project-1',
      workflowType: 'custom.workflow',
      userId: 'user-1',
      executionInput: { user_text: 'runtime text' },
    })
  })
})
