import { safeParseJsonArray } from '@/lib/json-repair'
import { normalizeAnyError } from '@/lib/errors/normalize'
import type { ScriptToStoryboardStepMeta, ScriptToStoryboardStepOutput } from '@/lib/novel-promotion/script-to-storyboard/orchestrator'
import { listArtifacts } from '@/lib/run-runtime/service'
import type { ActingDirection, ClipCharacterRef, PhotographyRule, StoryboardPanel } from '@/lib/storyboard-phases'
import type { ClipPanelsResult, JsonRecord } from './script-to-storyboard-helpers'

export type StoryboardClipInput = { id: string; content: string | null; characters: string | null; location: string | null; props?: string | null; screenplay: string | null }
export type StoryboardRetryPhase = 'phase1' | 'phase2_cinematography' | 'phase2_acting' | 'phase3_detail'
export type StoryboardRetryTarget = { stepKey: string; clipId: string; phase: StoryboardRetryPhase }
export type ScriptToStoryboardAtomicRetryResult = { clipPanels: ClipPanelsResult[]; phase1PanelsByClipId: Record<string, StoryboardPanel[]>; phase2CinematographyByClipId: Record<string, PhotographyRule[]>; phase2ActingByClipId: Record<string, ActingDirection[]>; phase3PanelsByClipId: Record<string, StoryboardPanel[]>; totalPanelCount: number; totalStepCount: number }

export type StepRunner = (
  meta: ScriptToStoryboardStepMeta,
  prompt: string,
  action: string,
  maxOutputTokens: number,
) => Promise<ScriptToStoryboardStepOutput>

const MAX_STEP_ATTEMPTS = 3
const MAX_RETRY_DELAY_MS = 10_000

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asObjectArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is JsonRecord => typeof item === 'object' && item !== null)
}

export function parseClipCharacters(raw: string | null): ClipCharacterRef[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('characters field must be JSON array')
    }
    return parsed as ClipCharacterRef[]
  } catch (error) {
    throw new Error(`Invalid clip characters JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function parseScreenplay(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Invalid clip screenplay JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function parseClipProps(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('props field must be JSON array')
    }
    return parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
  } catch (error) {
    throw new Error(`Invalid clip props JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function parseJsonArray<T extends JsonRecord>(responseText: string, label: string): T[] {
  const rows = safeParseJsonArray(responseText)
  if (rows.length === 0) {
    throw new Error(`${label}: empty result`)
  }
  return rows as T[]
}

function shouldRetryStepError(error: unknown, message: string, retryable: boolean) {
  if (retryable) return true
  const lowerMessage = message.toLowerCase()
  return lowerMessage.includes('json') || lowerMessage.includes('parse')
}

function computeRetryDelayMs(attempt: number) {
  const base = Math.min(1_000 * Math.pow(2, Math.max(0, attempt - 1)), MAX_RETRY_DELAY_MS)
  const jitter = Math.floor(Math.random() * 300)
  return base + jitter
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractArtifactRows<T extends JsonRecord>(payload: unknown, key: string): T[] {
  const record = asObject(payload)
  if (!record) return []
  return asObjectArray(record[key]) as T[]
}

export async function readArtifactRows<T extends JsonRecord>(params: { runId: string; clipId: string; artifactType: string; key: string }) {
  const rows = await listArtifacts({
    runId: params.runId,
    artifactType: params.artifactType,
    refId: params.clipId,
    limit: 1,
  })
  const artifact = rows[0]
  if (!artifact) return []
  return extractArtifactRows<T>(artifact.payload, params.key)
}

function getStepNumbers(params: { phase: StoryboardRetryPhase; clipIndex: number; totalClipCount: number }) {
  const zeroBasedClipIndex = params.clipIndex
  const totalStepCount = params.totalClipCount * 4 + 2
  if (params.phase === 'phase1') {
    return { stepIndex: zeroBasedClipIndex + 1, stepTotal: totalStepCount }
  }
  if (params.phase === 'phase2_cinematography') {
    return {
      stepIndex: params.totalClipCount + zeroBasedClipIndex * 3 + 1,
      stepTotal: totalStepCount,
    }
  }
  if (params.phase === 'phase2_acting') {
    return {
      stepIndex: params.totalClipCount + zeroBasedClipIndex * 3 + 2,
      stepTotal: totalStepCount,
    }
  }
  return {
    stepIndex: params.totalClipCount + zeroBasedClipIndex * 3 + 3,
    stepTotal: totalStepCount,
  }
}

export function buildStepMeta(params: { target: StoryboardRetryTarget; clipIndex: number; totalClipCount: number }): ScriptToStoryboardStepMeta {
  const stepNumbers = getStepNumbers({
    phase: params.target.phase,
    clipIndex: params.clipIndex,
    totalClipCount: params.totalClipCount,
  })
  const stepKey = params.target.stepKey
  const groupId = `clip_${params.target.clipId}`

  if (params.target.phase === 'phase1') {
    return {
      stepId: stepKey,
      stepTitle: 'progress.streamStep.storyboardPlan',
      stepIndex: stepNumbers.stepIndex,
      stepTotal: stepNumbers.stepTotal,
      groupId,
      parallelKey: 'phase1',
      retryable: true,
    }
  }
  if (params.target.phase === 'phase2_cinematography') {
    return {
      stepId: stepKey,
      stepTitle: 'progress.streamStep.cinematographyRules',
      stepIndex: stepNumbers.stepIndex,
      stepTotal: stepNumbers.stepTotal,
      dependsOn: [`clip_${params.target.clipId}_phase1`],
      groupId,
      parallelKey: 'phase2',
      retryable: true,
    }
  }
  if (params.target.phase === 'phase2_acting') {
    return {
      stepId: stepKey,
      stepTitle: 'progress.streamStep.actingDirection',
      stepIndex: stepNumbers.stepIndex,
      stepTotal: stepNumbers.stepTotal,
      dependsOn: [`clip_${params.target.clipId}_phase1`],
      groupId,
      parallelKey: 'phase2',
      retryable: true,
    }
  }
  return {
    stepId: stepKey,
    stepTitle: 'progress.streamStep.storyboardDetailRefine',
    stepIndex: stepNumbers.stepIndex,
    stepTotal: stepNumbers.stepTotal,
    dependsOn: [
      `clip_${params.target.clipId}_phase2_cinematography`,
      `clip_${params.target.clipId}_phase2_acting`,
    ],
    groupId,
    parallelKey: 'phase3',
    retryable: true,
  }
}

export async function runStepWithRetry<T>(params: {
  runStep: StepRunner
  baseMeta: ScriptToStoryboardStepMeta
  prompt: string
  action: string
  maxOutputTokens: number
  parse: (text: string) => T
  retryStepAttempt: number
}) {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_STEP_ATTEMPTS; attempt += 1) {
    const stepAttempt = params.retryStepAttempt + attempt - 1
    const meta: ScriptToStoryboardStepMeta = {
      ...params.baseMeta,
      stepAttempt,
    }
    try {
      const output = await params.runStep(meta, params.prompt, params.action, params.maxOutputTokens)
      return params.parse(output.text)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const normalized = normalizeAnyError(error, { context: 'worker' })
      const shouldRetry = attempt < MAX_STEP_ATTEMPTS
        && shouldRetryStepError(error, normalized.message, normalized.retryable)
      if (!shouldRetry) break
      await wait(computeRetryDelayMs(attempt))
    }
  }
  throw lastError || new Error('step execution failed')
}

export function mergePanelsWithRules(params: {
  finalPanels: StoryboardPanel[]
  photographyRules: PhotographyRule[]
  actingDirections: ActingDirection[]
}) {
  const { finalPanels, photographyRules, actingDirections } = params
  return finalPanels.map((panel, index) => {
    const rule = photographyRules.find((item) => item.panel_number === panel.panel_number)
    if (!rule) {
      throw new Error(`Missing photography rule for panel_number=${String(panel.panel_number)} at index=${index}`)
    }
    const acting = actingDirections.find((item) => item.panel_number === panel.panel_number)
    if (!acting) {
      throw new Error(`Missing acting direction for panel_number=${String(panel.panel_number)} at index=${index}`)
    }
    return {
      ...panel,
      photographyPlan: {
        composition: rule.composition,
        lighting: rule.lighting,
        colorPalette: rule.color_palette,
        atmosphere: rule.atmosphere,
        technicalNotes: rule.technical_notes,
      },
      actingNotes: acting.characters,
    }
  })
}

export function requireRows<T extends JsonRecord>(rows: T[], label: string) {
  if (rows.length === 0) {
    throw new Error(`missing dependency artifact: ${label}`)
  }
  return rows
}

export function parseStoryboardRetryTarget(stepKey: string): StoryboardRetryTarget | null {
  const trimmed = stepKey.trim()
  if (!trimmed) return null
  const match = /^clip_(.+)_(phase1|phase2_cinematography|phase2_acting|phase3_detail)$/.exec(trimmed)
  if (!match) return null
  const clipId = (match[1] || '').trim()
  const phase = match[2] as StoryboardRetryPhase
  if (!clipId) return null
  return {
    stepKey: trimmed,
    clipId,
    phase,
  }
}
