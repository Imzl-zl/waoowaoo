import { NextRequest, NextResponse } from 'next/server'
import { isErrorResponse, requireProjectAuthLight } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'
import {
  getProjectWorkflowDefinition,
  saveProjectWorkflowDefinitionDraft,
} from '@/lib/workflow-engine/definition-store'

function readDefinitionPayload(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  return record.definition || body
}

export const GET = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; workflowType: string }> },
) => {
  const { projectId, workflowType } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const workflowDefinition = await getProjectWorkflowDefinition({
    projectId,
    workflowType,
    userId: authResult.session.user.id,
  })
  if (!workflowDefinition) throw new ApiError('NOT_FOUND')
  return NextResponse.json({ workflowDefinition })
})

export const PUT = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string; workflowType: string }> },
) => {
  const { projectId, workflowType } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json().catch(() => null)
  const definition = readDefinitionPayload(body)
  if (!definition) throw new ApiError('INVALID_PARAMS')

  const workflowDefinition = await saveProjectWorkflowDefinitionDraft({
    projectId,
    workflowType,
    userId: authResult.session.user.id,
    definition,
  })
  return NextResponse.json({ workflowDefinition })
})
