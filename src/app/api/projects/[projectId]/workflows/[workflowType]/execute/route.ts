import { NextRequest, NextResponse } from 'next/server'
import { isErrorResponse, requireProjectAuthLight } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'
import { executeProjectPublishedWorkflowDefinition } from '@/lib/workflow-engine/published-workflow-execution'

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string; workflowType: string }> },
) => {
  const { projectId, workflowType } = await context.params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const body = await request.json().catch(() => null)

  const result = await executeProjectPublishedWorkflowDefinition({
    projectId,
    workflowType,
    userId: authResult.session.user.id,
    executionInput: body,
  })
  return NextResponse.json(result)
})
