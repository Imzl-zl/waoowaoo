import { NextRequest, NextResponse } from 'next/server'
import { isErrorResponse, requireProjectAuthLight } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'
import { extractProjectProductionPrep } from '@/lib/production-prep'

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json().catch(() => null)
  const result = await extractProjectProductionPrep({
    projectId,
    userId: authResult.session.user.id,
    projectName: authResult.project.name,
    body,
  })
  return NextResponse.json(result)
})
