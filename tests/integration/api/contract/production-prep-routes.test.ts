import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-errors'
import { productionPrepDocument } from '../../../unit/production-prep/helpers'
import { buildMockRequest } from '../../../helpers/request'

const authState = vi.hoisted(() => ({
  mode: 'authenticated' as 'authenticated' | 'unauthenticated' | 'forbidden',
}))

const productionPrepMock = vi.hoisted(() => ({
  getProjectProductionPrep: vi.fn(),
  saveProjectProductionPrep: vi.fn(),
  extractProjectProductionPrep: vi.fn(),
  planProjectProductionPrepEpisodes: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => {
  const errorResponse = (code: string, status: number) => new Response(
    JSON.stringify({ error: { code } }),
    { status, headers: { 'content-type': 'application/json' } },
  )

  return {
    isErrorResponse: (value: unknown) => value instanceof Response,
    requireProjectAuthLight: async (projectId: string) => {
      if (authState.mode === 'unauthenticated') return errorResponse('UNAUTHORIZED', 401)
      if (authState.mode === 'forbidden') return errorResponse('FORBIDDEN', 403)
      return {
        session: { user: { id: 'user-1' } },
        project: { id: projectId, userId: 'user-1', name: 'River Case Project' },
      }
    },
  }
})

vi.mock('@/lib/production-prep', () => productionPrepMock)

function detail(version = 0) {
  const document = productionPrepDocument()
  return {
    id: version === 0 ? null : 'prep-1',
    projectId: 'project-1',
    userId: 'user-1',
    document,
    version,
    sourceMode: document.sourceMode,
    lastGeneratedSource: null,
    createdAt: null,
    updatedAt: null,
    validation: { valid: true, issues: [] },
  }
}

describe('api contract - production prep routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.mode = 'authenticated'
    productionPrepMock.getProjectProductionPrep.mockResolvedValue(detail(0))
    productionPrepMock.saveProjectProductionPrep.mockResolvedValue({
      productionPrep: detail(1),
      conflicts: [],
    })
    productionPrepMock.extractProjectProductionPrep.mockResolvedValue({
      productionPrep: detail(2),
      conflicts: [{ section: 'characters', path: 'assets.characters.char.lin', message: 'locked' }],
      generated: { model: 'openai::gpt-test' },
    })
    productionPrepMock.planProjectProductionPrepEpisodes.mockResolvedValue({
      productionPrep: detail(3),
      conflicts: [],
      generated: { model: 'openai::gpt-test' },
    })
  })

  it('GET rejects unauthenticated requests before service access', async () => {
    authState.mode = 'unauthenticated'
    const { GET } = await import('@/app/api/projects/[projectId]/production-prep/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1/production-prep',
      method: 'GET',
    })

    const res = await GET(req, { params: Promise.resolve({ projectId: 'project-1' }) })

    expect(res.status).toBe(401)
    expect(productionPrepMock.getProjectProductionPrep).not.toHaveBeenCalled()
  })

  it('rejects non-project owners before service access', async () => {
    authState.mode = 'forbidden'
    const { PUT } = await import('@/app/api/projects/[projectId]/production-prep/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1/production-prep',
      method: 'PUT',
      body: { document: productionPrepDocument() },
    })

    const res = await PUT(req, { params: Promise.resolve({ projectId: 'project-1' }) })

    expect(res.status).toBe(403)
    expect(productionPrepMock.saveProjectProductionPrep).not.toHaveBeenCalled()
  })

  it('GET returns the editable empty production prep structure', async () => {
    const { GET } = await import('@/app/api/projects/[projectId]/production-prep/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1/production-prep',
      method: 'GET',
    })

    const res = await GET(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    const payload = await res.json() as { productionPrep: { version: number; document: { title: string } } }

    expect(res.status).toBe(200)
    expect(payload.productionPrep.version).toBe(0)
    expect(payload.productionPrep.document.title).toBe('River Case')
    expect(productionPrepMock.getProjectProductionPrep).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'user-1',
      projectName: 'River Case Project',
    })
  })

  it('PUT delegates schema validation and returns 400 for invalid documents', async () => {
    productionPrepMock.saveProjectProductionPrep.mockRejectedValueOnce(new ApiError('INVALID_PARAMS', {
      message: 'production prep document failed validation',
    }))
    const { PUT } = await import('@/app/api/projects/[projectId]/production-prep/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1/production-prep',
      method: 'PUT',
      body: { document: { schemaVersion: 1, title: '' } },
    })

    const res = await PUT(req, { params: Promise.resolve({ projectId: 'project-1' }) })

    expect(res.status).toBe(400)
    expect(productionPrepMock.saveProjectProductionPrep).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'user-1',
      document: { schemaVersion: 1, title: '' },
    })
  })

  it('PUT saves manual edits through the service layer', async () => {
    const document = productionPrepDocument()
    const { PUT } = await import('@/app/api/projects/[projectId]/production-prep/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1/production-prep',
      method: 'PUT',
      body: { document },
    })

    const res = await PUT(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    const payload = await res.json() as { productionPrep: { version: number } }

    expect(res.status).toBe(200)
    expect(payload.productionPrep.version).toBe(1)
    expect(productionPrepMock.saveProjectProductionPrep).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'user-1',
      document,
    })
  })

  it('POST extract generates, merges, saves, and returns conflicts explicitly', async () => {
    const { POST } = await import('@/app/api/projects/[projectId]/production-prep/extract/route')
    const body = { sourceText: 'novel text', sourceMode: 'novel' }
    const req = buildMockRequest({
      path: '/api/projects/project-1/production-prep/extract',
      method: 'POST',
      body,
    })

    const res = await POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    const payload = await res.json() as { productionPrep: { version: number }; conflicts: unknown[] }

    expect(res.status).toBe(200)
    expect(payload.productionPrep.version).toBe(2)
    expect(payload.conflicts).toHaveLength(1)
    expect(productionPrepMock.extractProjectProductionPrep).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'user-1',
      projectName: 'River Case Project',
      body,
    })
  })

  it('POST plan-episodes generates and saves episode plans from the saved document', async () => {
    const { POST } = await import('@/app/api/projects/[projectId]/production-prep/plan-episodes/route')
    const body = {
      episodeCount: 6,
      targetDurationSeconds: 900,
      minDurationSeconds: 780,
      maxDurationSeconds: 1020,
      pacing: 'balanced',
    }
    const req = buildMockRequest({
      path: '/api/projects/project-1/production-prep/plan-episodes',
      method: 'POST',
      body,
    })

    const res = await POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    const payload = await res.json() as { productionPrep: { version: number } }

    expect(res.status).toBe(200)
    expect(payload.productionPrep.version).toBe(3)
    expect(productionPrepMock.planProjectProductionPrepEpisodes).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'user-1',
      body,
    })
  })
})
