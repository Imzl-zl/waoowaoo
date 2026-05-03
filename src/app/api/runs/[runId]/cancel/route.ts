import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { requestManagedRunCancel } from '@/lib/run-runtime/cancel'

export const POST = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { runId } = await context.params

  const result = await requestManagedRunCancel({
    runId,
    userId: session.user.id,
  })
  if (!result) {
    throw new ApiError('NOT_FOUND')
  }

  return NextResponse.json({
    success: true,
    run: result.run,
  })
})
