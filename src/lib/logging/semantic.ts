import { createScopedLogger } from './core'
import { registerProjectName } from './file-writer'

function maybeRegisterProject(projectId?: string, projectName?: string): void {
  if (projectId && projectName) {
    registerProjectName(projectId, projectName)
  }
}

type AnyRecord = Record<string, unknown>
type SemanticLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const toOptionalString = (value: string | null | undefined): string | undefined => value ?? undefined

function toDetails(input: unknown): AnyRecord | unknown[] | null {
  if (input == null) return null
  if (Array.isArray(input)) return input
  if (typeof input === 'object') return input as AnyRecord
  return { value: input }
}

function resolveMessage(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function resolveDetails(messageOrDetails: unknown, details: unknown): unknown {
  if (typeof messageOrDetails === 'string') return details
  if (details == null) return messageOrDetails
  return {
    messageOrDetails,
    details,
  }
}

function createSemanticLogger(module: string) {
  return createScopedLogger({ module })
}

export function logInternal(
  module: string,
  level: SemanticLevel,
  message: string,
  details?: unknown,
  projectId?: string,
): void {
  createSemanticLogger(module).event({
    level,
    action: 'internal',
    message,
    projectId,
    details: toDetails(details),
  })
}

export function logUserAction(
  action: string,
  userId: string,
  username: string,
  message: unknown,
  details?: unknown,
  projectId?: string,
  projectName?: string,
): void {
  createSemanticLogger('user').event({
    level: 'INFO',
    audit: true,
    action,
    message: resolveMessage(message, action),
    userId,
    projectId,
    details: {
      ...(typeof details === 'object' && details != null ? (details as AnyRecord) : { details }),
      username,
      projectName,
    },
  })
}

export function logAIAnalysis(
  action: string,
  message: unknown,
  details?: unknown,
  userId?: string | null,
  username?: string | null,
  projectId?: string | null,
  projectName?: string | null,
): void {
  const logUserId = toOptionalString(userId)
  const logUsername = toOptionalString(username)
  const logProjectId = toOptionalString(projectId)
  const logProjectName = toOptionalString(projectName)
  const resolvedDetails = resolveDetails(message, details ?? null)

  maybeRegisterProject(logProjectId, logProjectName)
  createSemanticLogger('ai').event({
    level: 'INFO',
    audit: true,
    action,
    message: resolveMessage(message, action),
    userId: logUserId,
    projectId: logProjectId,
    details: {
      ...(typeof resolvedDetails === 'object' && resolvedDetails != null
        ? (resolvedDetails as AnyRecord)
        : { details: resolvedDetails }),
      username: logUsername,
      projectName: logProjectName,
    },
  })
}

export function logProjectAction(
  action: string,
  message: unknown,
  details?: unknown,
  userId?: string | null,
  username?: string | null,
  projectId?: string | null,
  projectName?: string | null,
): void {
  const logUserId = toOptionalString(userId)
  const logUsername = toOptionalString(username)
  const logProjectId = toOptionalString(projectId)
  const logProjectName = toOptionalString(projectName)
  const resolvedDetails = resolveDetails(message, details ?? null)

  maybeRegisterProject(logProjectId, logProjectName)
  createSemanticLogger('project').event({
    level: 'INFO',
    audit: true,
    action,
    message: resolveMessage(message, action),
    userId: logUserId,
    projectId: logProjectId,
    details: {
      ...(typeof resolvedDetails === 'object' && resolvedDetails != null
        ? (resolvedDetails as AnyRecord)
        : { details: resolvedDetails }),
      username: logUsername,
      projectName: logProjectName,
    },
  })
}

export function logAuthAction(
  action: string,
  message: unknown,
  details?: unknown,
  userId?: string,
  username?: string,
): void {
  createSemanticLogger('auth').event({
    level: 'INFO',
    audit: true,
    action,
    message: resolveMessage(message, action),
    userId,
    details: {
      ...(typeof details === 'object' && details != null ? (details as AnyRecord) : { details }),
      username,
    },
  })
}
