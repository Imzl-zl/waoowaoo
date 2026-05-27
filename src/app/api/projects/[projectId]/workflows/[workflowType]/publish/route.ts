import { NextRequest, NextResponse } from 'next/server'
import { isErrorResponse, requireProjectAuthLight } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'
import { publishProjectWorkflowDefinition } from '@/lib/workflow-engine/definition-store'

export const POST = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; workflowType: string }> },
) => {
  const { projectId, workflowType } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const result = await publishProjectWorkflowDefinition({
    projectId,
    workflowType,
    userId: authResult.session.user.id,
  })
  return NextResponse.json(result)
})
