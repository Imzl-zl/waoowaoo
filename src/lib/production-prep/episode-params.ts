import { ApiError } from '@/lib/api-errors'

export type EpisodePlanPacing = 'slow' | 'balanced' | 'fast'

export type NormalizedEpisodePlanningParams = Readonly<{
  episodeCount: number
  targetDurationSeconds: number
  minDurationSeconds: number
  maxDurationSeconds: number
  pacing: EpisodePlanPacing
  instruction: string
  language: string
}>

const DEFAULT_EPISODE_COUNT = 6
const DEFAULT_TARGET_SECONDS = 900
const DEFAULT_DURATION_SPREAD_SECONDS = 120
const MIN_DURATION_SECONDS = 60
const MAX_EPISODE_COUNT = 100
const PACING_VALUES = new Set<EpisodePlanPacing>(['slow', 'balanced', 'fast'])

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function positiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return NaN
  return Math.floor(numeric)
}

function readPacing(value: unknown): EpisodePlanPacing {
  if (typeof value === 'string' && PACING_VALUES.has(value as EpisodePlanPacing)) {
    return value as EpisodePlanPacing
  }
  return 'balanced'
}

export function normalizeEpisodePlanningParams(input: unknown): NormalizedEpisodePlanningParams {
  const record = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const episodeCount = positiveInt(record.episodeCount, DEFAULT_EPISODE_COUNT)
  const targetDurationSeconds = positiveInt(record.targetDurationSeconds, DEFAULT_TARGET_SECONDS)
  const minDurationSeconds = positiveInt(
    record.minDurationSeconds,
    Math.max(MIN_DURATION_SECONDS, targetDurationSeconds - DEFAULT_DURATION_SPREAD_SECONDS),
  )
  const maxDurationSeconds = positiveInt(
    record.maxDurationSeconds,
    targetDurationSeconds + DEFAULT_DURATION_SPREAD_SECONDS,
  )

  if (
    episodeCount < 1
    || episodeCount > MAX_EPISODE_COUNT
    || targetDurationSeconds < MIN_DURATION_SECONDS
    || minDurationSeconds < MIN_DURATION_SECONDS
    || maxDurationSeconds < MIN_DURATION_SECONDS
    || minDurationSeconds > targetDurationSeconds
    || maxDurationSeconds < targetDurationSeconds
  ) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PRODUCTION_PREP_EPISODE_PARAMS_INVALID',
      message: 'episode planning parameters are invalid',
    })
  }

  return {
    episodeCount,
    targetDurationSeconds,
    minDurationSeconds,
    maxDurationSeconds,
    pacing: readPacing(record.pacing),
    instruction: optionalString(record.instruction),
    language: optionalString(record.language) || 'zh-CN',
  }
}
