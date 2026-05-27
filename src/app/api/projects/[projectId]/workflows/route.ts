import { NextRequest, NextResponse } from 'next/server'
import { isErrorResponse, requireProjectAuthLight } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'
import {
  listProjectWorkflowDefinitions,
  saveProjectWorkflowDefinitionDraft,
} from '@/lib/workflow-engine/definition-store'

function readDefinitionPayload(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  return record.definition || body
}

export const GET = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const workflowDefinitions = await listProjectWorkflowDefinitions({
    projectId,
    userId: authResult.session.user.id,
  })
  return NextResponse.json({ workflowDefinitions })
})

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json().catch(() => null)
  const definition = readDefinitionPayload(body)
  if (!definition) throw new ApiError('INVALID_PARAMS')

  const workflowDefinition = await saveProjectWorkflowDefinitionDraft({
    projectId,
    userId: authResult.session.user.id,
    definition,
  })
  return NextResponse.json({ workflowDefinition })
})
