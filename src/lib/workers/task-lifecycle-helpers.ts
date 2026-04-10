import type { Job } from 'bullmq'
import type { NormalizedError } from '@/lib/errors/types'
import { onProjectNameAvailable } from '@/lib/logging/file-writer'
import { prisma } from '@/lib/prisma'
import type { TaskJobData } from '@/lib/task/types'

function resolveQueueAttempts(job: Job<TaskJobData>): number {
  const attempts = job.opts?.attempts ?? 1
  const value = typeof attempts === 'number' && Number.isFinite(attempts) ? Math.floor(attempts) : 1
  return Math.max(1, value)
}

function resolveAttemptsMade(job: Job<TaskJobData>): number {
  const attemptsMade = job.attemptsMade
  const value = typeof attemptsMade === 'number' && Number.isFinite(attemptsMade) ? Math.floor(attemptsMade) : 0
  return Math.max(0, value)
}

function resolveNextBackoffMs(job: Job<TaskJobData>, failedAttempt: number): number | null {
  const backoff = job.opts?.backoff
  if (typeof backoff === 'number' && Number.isFinite(backoff) && backoff > 0) {
    return Math.floor(backoff)
  }
  if (!backoff || typeof backoff !== 'object') return null

  const backoffRecord = backoff as { type?: unknown; delay?: unknown }
  const baseDelay = typeof backoffRecord.delay === 'number' && Number.isFinite(backoffRecord.delay)
    ? Math.max(0, Math.floor(backoffRecord.delay))
    : 0
  if (baseDelay <= 0) return null

  const type = typeof backoffRecord.type === 'string' ? backoffRecord.type : 'fixed'
  if (type === 'exponential') {
    const exponent = Math.max(0, failedAttempt - 1)
    return baseDelay * Math.pow(2, exponent)
  }
  return baseDelay
}

export function shouldRetryInQueue(params: {
  job: Job<TaskJobData>
  normalizedError: NormalizedError
}): {
  enabled: boolean
  failedAttempt: number
  maxAttempts: number
  nextBackoffMs: number | null
} {
  const maxAttempts = resolveQueueAttempts(params.job)
  const failedAttempt = resolveAttemptsMade(params.job) + 1
  return {
    enabled: params.normalizedError.retryable && failedAttempt < maxAttempts,
    failedAttempt,
    maxAttempts,
    nextBackoffMs: resolveNextBackoffMs(params.job, failedAttempt),
  }
}

export function buildErrorCauseChain(input: unknown): Array<{ name: string; message: string }> {
  const chain: Array<{ name: string; message: string }> = []
  const seen = new Set<unknown>()
  let current: unknown = input

  for (let depth = 0; depth < 6; depth += 1) {
    if (!current || seen.has(current)) break
    seen.add(current)
    if (!(current instanceof Error)) {
      chain.push({ name: typeof current, message: String(current) })
      break
    }
    chain.push({
      name: current.name || 'Error',
      message: current.message || '',
    })
    const next = (current as Error & { cause?: unknown }).cause
    if (!next) break
    current = next
  }

  return chain
}

export async function resolveProjectNameForLogging(projectId: string): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })
    if (project?.name) {
      onProjectNameAvailable(projectId, project.name)
    }
  } catch {
    // Swallow – log file routing failure should never crash the worker.
  }
}
