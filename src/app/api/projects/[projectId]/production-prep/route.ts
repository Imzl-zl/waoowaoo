import { NextRequest, NextResponse } from 'next/server'
import { isErrorResponse, requireProjectAuthLight } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'
import {
  getProjectProductionPrep,
  saveProjectProductionPrep,
} from '@/lib/production-prep'

function readDocumentPayload(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  return record.document || body
}

export const GET = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const productionPrep = await getProjectProductionPrep({
    projectId,
    userId: authResult.session.user.id,
    projectName: authResult.project.name,
  })
  return NextResponse.json({ productionPrep })
})

export const PUT = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json().catch(() => null)
  const document = readDocumentPayload(body)
  if (!document) throw new ApiError('INVALID_PARAMS')

  const result = await saveProjectProductionPrep({
    projectId,
    userId: authResult.session.user.id,
    document,
  })
  return NextResponse.json(result)
})
