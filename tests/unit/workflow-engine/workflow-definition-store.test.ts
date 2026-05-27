import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-errors'
import {
  getProjectPublishedWorkflowDefinitionVersion,
  getProjectWorkflowDefinition,
  listProjectWorkflowDefinitions,
  publishProjectWorkflowDefinition,
  saveProjectWorkflowDefinitionDraft,
} from '@/lib/workflow-engine/definition-store'
import type { WorkflowCanvasDefinition } from '@/lib/workflow-engine/canvas-types'
import { WORKFLOW_NODE_TYPES } from '@/lib/workflow-engine/node-catalog'

type DefinitionRow = {
  id: string
  projectId: string
  userId: string
  workflowType: string
  title: string
  draftDefinition: unknown
  draftValidation: unknown
  publishedVersion: number | null
  publishedVersionId: string | null
  createdAt: Date
  updatedAt: Date
}

type VersionRow = {
  id: string
  workflowDefinitionId: string
  projectId: string
  userId: string
  workflowType: string
  title: string
  version: number
  definition: unknown
  validation: unknown
  createdAt: Date
}

function buildCanvas(overrides: Partial<WorkflowCanvasDefinition> = {}): WorkflowCanvasDefinition {
  return {
    schemaVersion: 1,
    workflowType: 'custom.workflow',
    title: 'Custom workflow',
    nodes: [
      { id: 'trigger', type: WORKFLOW_NODE_TYPES.MANUAL_TRIGGER },
      { id: 'draft', type: WORKFLOW_NODE_TYPES.LLM_TRANSFORM, step: { key: 'write_draft' } },
      { id: 'output', type: WORKFLOW_NODE_TYPES.OUTPUT_RESULT },
    ],
    edges: [
      { id: 'trigger-draft', sourceNodeId: 'trigger', sourcePort: 'out', targetNodeId: 'draft', targetPort: 'in' },
      { id: 'draft-output', sourceNodeId: 'draft', sourcePort: 'out', targetNodeId: 'output', targetPort: 'in' },
    ],
    ...overrides,
  }
}

function createMockDb() {
  const definitions: DefinitionRow[] = []
  const versions: VersionRow[] = []
  let definitionSeq = 0
  let versionSeq = 0

  const findDefinition = (where: Record<string, unknown>) => {
    if ('id' in where) return definitions.find((row) => row.id === where.id) || null
    const composite = where.projectId_workflowType as { projectId: string; workflowType: string }
    return definitions.find((row) => (
      row.projectId === composite.projectId && row.workflowType === composite.workflowType
    )) || null
  }

  const workflowDefinition = {
    findMany: async (params: { where: { projectId: string; userId: string } }) =>
      definitions.filter((row) => (
        row.projectId === params.where.projectId && row.userId === params.where.userId
      )),
    findUnique: async (params: { where: Record<string, unknown> }) => findDefinition(params.where),
    create: async (params: { data: Omit<DefinitionRow, 'id' | 'createdAt' | 'updatedAt' | 'publishedVersion' | 'publishedVersionId'> }) => {
      const now = new Date()
      const row: DefinitionRow = {
        ...params.data,
        id: `definition-${++definitionSeq}`,
        publishedVersion: null,
        publishedVersionId: null,
        createdAt: now,
        updatedAt: now,
      }
      definitions.push(row)
      return row
    },
    update: async (params: { where: { id: string }; data: Partial<DefinitionRow> }) => {
      const row = definitions.find((item) => item.id === params.where.id)
      if (!row) throw new Error('definition not found')
      Object.assign(row, params.data, { updatedAt: new Date() })
      return row
    },
    upsert: async () => {
      throw new Error('upsert should not be used')
    },
  }
  const workflowDefinitionVersion = {
    create: async (params: { data: Omit<VersionRow, 'id' | 'createdAt'> }) => {
      const row: VersionRow = {
        ...params.data,
        id: `version-${++versionSeq}`,
        createdAt: new Date(),
      }
      versions.push(row)
      return row
    },
    findUnique: async (params: { where: { id: string } }) =>
      versions.find((row) => row.id === params.where.id) || null,
  }
  return {
    definitions,
    versions,
    db: {
      workflowDefinition,
      workflowDefinitionVersion,
      $transaction: async <T>(fn: (tx: {
        workflowDefinition: typeof workflowDefinition
        workflowDefinitionVersion: typeof workflowDefinitionVersion
      }) => Promise<T>) => await fn({ workflowDefinition, workflowDefinitionVersion }),
    },
  }
}

describe('workflow definition store', () => {
  let store: ReturnType<typeof createMockDb>

  beforeEach(() => {
    store = createMockDb()
  })

  it('saves and lists project-scoped draft definitions with validation result', async () => {
    const saved = await saveProjectWorkflowDefinitionDraft({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      definition: buildCanvas(),
    })
    const listed = await listProjectWorkflowDefinitions({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
    })

    expect(saved.workflowType).toBe('custom.workflow')
    expect(saved.draftValidation.valid).toBe(true)
    expect(listed).toHaveLength(1)
    expect(listed[0]).not.toHaveProperty('draftDefinition')
  })

  it('rejects malformed definitions and route workflowType mismatches', async () => {
    await expect(saveProjectWorkflowDefinitionDraft({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'other.workflow',
      definition: buildCanvas(),
    })).rejects.toMatchObject({ code: 'INVALID_PARAMS' })

    await expect(saveProjectWorkflowDefinitionDraft({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      definition: { schemaVersion: 1, workflowType: 'bad', title: 'Bad', nodes: [{ id: '' }], edges: [] },
    })).rejects.toBeInstanceOf(ApiError)
  })

  it('publishes a valid draft as an immutable incrementing version', async () => {
    await saveProjectWorkflowDefinitionDraft({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      definition: buildCanvas(),
    })

    const first = await publishProjectWorkflowDefinition({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    })
    const second = await publishProjectWorkflowDefinition({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    })

    expect(first.version.version).toBe(1)
    expect(second.version.version).toBe(2)
    expect(store.versions).toHaveLength(2)
    expect(second.definition.publishedVersionId).toBe('version-2')
  })

  it('reads only the latest published immutable version for the owner', async () => {
    await saveProjectWorkflowDefinitionDraft({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      definition: buildCanvas({ title: 'Version one' }),
    })
    await publishProjectWorkflowDefinition({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    })
    await saveProjectWorkflowDefinitionDraft({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      definition: buildCanvas({ title: 'Draft after publish' }),
    })

    const published = await getProjectPublishedWorkflowDefinitionVersion({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    })

    expect(published).toEqual(expect.objectContaining({
      id: 'version-1',
      title: 'Version one',
      version: 1,
    }))
    expect(published?.definition.title).toBe('Version one')
    await expect(getProjectPublishedWorkflowDefinitionVersion({
      db: store.db,
      projectId: 'project-1',
      userId: 'other-user',
      workflowType: 'custom.workflow',
    })).resolves.toBeNull()
  })

  it('returns null when no published version exists', async () => {
    await saveProjectWorkflowDefinitionDraft({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      definition: buildCanvas(),
    })

    await expect(getProjectPublishedWorkflowDefinitionVersion({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    })).resolves.toBeNull()
  })

  it('rejects publishing invalid drafts and hides other users definitions', async () => {
    await saveProjectWorkflowDefinitionDraft({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      definition: buildCanvas({
        edges: [],
      }),
    })

    await expect(publishProjectWorkflowDefinition({
      db: store.db,
      projectId: 'project-1',
      userId: 'user-1',
      workflowType: 'custom.workflow',
    })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      details: expect.objectContaining({ code: 'WORKFLOW_DEFINITION_VALIDATION_FAILED' }),
    })

    await expect(getProjectWorkflowDefinition({
      db: store.db,
      projectId: 'project-1',
      userId: 'other-user',
      workflowType: 'custom.workflow',
    })).resolves.toBeNull()
  })
})
