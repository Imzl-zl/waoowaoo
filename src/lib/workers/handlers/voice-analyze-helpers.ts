import { safeParseJson, safeParseJsonArray } from '@/lib/json-repair'

export interface StoryboardPanelLike {
  id: string
  panelIndex: number
  srtSegment: string | null
  description: string | null
  characters: string | null
}

export interface StoryboardLike {
  id: string
  panels: StoryboardPanelLike[]
}

export interface VoiceLineMatchedPanel {
  storyboardId?: string
  panelIndex?: number
}

export interface VoiceLinePayload {
  lineIndex?: number
  speaker?: string
  content?: string
  emotionStrength?: number
  matchedPanel?: VoiceLineMatchedPanel | null
}

export interface StrictVoiceLine {
  lineIndex: number
  speaker: string
  content: string
  emotionStrength: number
  matchedPanelId: string | null
  matchedStoryboardId: string | null
  matchedPanelIndex: number | null
}

function parseVoiceLinePayload(value: unknown): VoiceLinePayload | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const matchedPanelRaw =
    record.matchedPanel && typeof record.matchedPanel === 'object'
      ? (record.matchedPanel as Record<string, unknown>)
      : null
  return {
    lineIndex: typeof record.lineIndex === 'number' ? record.lineIndex : undefined,
    speaker: typeof record.speaker === 'string' ? record.speaker : undefined,
    content: typeof record.content === 'string' ? record.content : undefined,
    emotionStrength: typeof record.emotionStrength === 'number' ? record.emotionStrength : undefined,
    matchedPanel: matchedPanelRaw
      ? {
        storyboardId: typeof matchedPanelRaw.storyboardId === 'string' ? matchedPanelRaw.storyboardId : undefined,
        panelIndex: typeof matchedPanelRaw.panelIndex === 'number' ? matchedPanelRaw.panelIndex : undefined,
      }
      : null,
  }
}

export function buildStoryboardJson(storyboards: StoryboardLike[]): string {
  const panelsData: Array<{
    storyboardId: string
    panelIndex: number
    text_segment: string
    description: string
    characters: string
  }> = []

  for (const sb of storyboards) {
    const panels = sb.panels || []
    for (const panel of panels) {
      panelsData.push({
        storyboardId: sb.id,
        panelIndex: panel.panelIndex,
        text_segment: panel.srtSegment || '',
        description: panel.description || '',
        characters: panel.characters || '',
      })
    }
  }

  if (panelsData.length === 0) {
    return '无分镜数据'
  }

  return JSON.stringify(panelsData, null, 2)
}

export function parseVoiceLinesJson(responseText: string): VoiceLinePayload[] {
  const parsed = safeParseJsonArray(responseText)
  if (parsed.length === 0) {
    const raw = safeParseJson(responseText)
    if (Array.isArray(raw) && raw.length === 0) {
      return []
    }
    throw new Error('Invalid voice lines data structure')
  }
  const voiceLines = parsed
    .map((item) => parseVoiceLinePayload(item))
    .filter((item): item is VoiceLinePayload => Boolean(item))
  if (voiceLines.length === 0) {
    throw new Error('Invalid voice lines data structure')
  }
  return voiceLines
}

export function buildStoryboardPanelIdMap(storyboards: StoryboardLike[]) {
  const panelIdByStoryboardPanel = new Map<string, string>()
  for (const storyboard of storyboards) {
    for (const panel of storyboard.panels || []) {
      panelIdByStoryboardPanel.set(`${storyboard.id}:${panel.panelIndex}`, panel.id)
    }
  }
  return panelIdByStoryboardPanel
}

export function toStrictVoiceLines(
  parsedLines: VoiceLinePayload[],
  panelIdByStoryboardPanel: Map<string, string>,
): StrictVoiceLine[] {
  return parsedLines.map((lineData, index) => {
    if (typeof lineData.lineIndex !== 'number' || !Number.isFinite(lineData.lineIndex)) {
      throw new Error(`voice line ${index + 1} is missing valid lineIndex`)
    }
    const lineIndex = Math.floor(lineData.lineIndex)
    if (lineIndex <= 0) {
      throw new Error(`voice line ${index + 1} has invalid lineIndex`)
    }
    if (typeof lineData.speaker !== 'string' || !lineData.speaker.trim()) {
      throw new Error(`voice line ${index + 1} is missing valid speaker`)
    }
    if (typeof lineData.content !== 'string' || !lineData.content.trim()) {
      throw new Error(`voice line ${index + 1} is missing valid content`)
    }
    if (typeof lineData.emotionStrength !== 'number' || !Number.isFinite(lineData.emotionStrength)) {
      throw new Error(`voice line ${index + 1} is missing valid emotionStrength`)
    }

    const speaker = lineData.speaker.trim()
    const emotionStrength = Math.min(1, Math.max(0.1, lineData.emotionStrength))
    const matchedPanel = lineData.matchedPanel
    if (!matchedPanel) {
      return {
        lineIndex,
        speaker,
        content: lineData.content,
        emotionStrength,
        matchedPanelId: null,
        matchedStoryboardId: null,
        matchedPanelIndex: null,
      }
    }

    const storyboardId = typeof matchedPanel.storyboardId === 'string' ? matchedPanel.storyboardId.trim() : ''
    const panelIndex = typeof matchedPanel.panelIndex === 'number' && Number.isFinite(matchedPanel.panelIndex)
      ? Math.floor(matchedPanel.panelIndex)
      : null
    if (!storyboardId || panelIndex === null || panelIndex < 0) {
      throw new Error(`voice line ${index + 1} has invalid matchedPanel`)
    }

    const panelKey = `${storyboardId}:${panelIndex}`
    const panelId = panelIdByStoryboardPanel.get(panelKey)
    if (!panelId) {
      throw new Error(`voice line ${index + 1} references non-existent panel ${panelKey}`)
    }

    return {
      lineIndex,
      speaker,
      content: lineData.content,
      emotionStrength,
      matchedPanelId: panelId,
      matchedStoryboardId: storyboardId,
      matchedPanelIndex: panelIndex,
    }
  })
}

export function summarizeVoiceLinesBySpeaker(
  voiceLines: Array<{ speaker: string; matchedStoryboardId: string | null }>,
) {
  const speakerStats: Record<string, number> = {}
  for (const line of voiceLines) {
    speakerStats[line.speaker] = (speakerStats[line.speaker] || 0) + 1
  }
  const matchedCount = voiceLines.filter((line) => line.matchedStoryboardId).length
  return { speakerStats, matchedCount }
}
