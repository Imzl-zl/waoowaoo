/**
 * 用户 API 配置管理接口
 *
 * GET  - 读取用户配置(解密)
 * PUT  - 保存/更新配置(加密)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import {
  getUserApiConfig,
  updateUserApiConfig,
} from '@/lib/user-api/api-config/service'
import type { ApiConfigPutBody } from '@/lib/user-api/api-config/types'

export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  return NextResponse.json(await getUserApiConfig(authResult.session.user.id))
})

export const PUT = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  let body: ApiConfigPutBody
  try {
    body = (await request.json()) as ApiConfigPutBody
  } catch {
    throw new ApiError('INVALID_PARAMS', {
      code: 'BODY_PARSE_FAILED',
      field: 'body',
    })
  }

  await updateUserApiConfig(authResult.session.user.id, body)
  return NextResponse.json({ success: true })
})
