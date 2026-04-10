export type AnyObj = Record<string, unknown>
export type JsonRecord = Record<string, unknown>

export function readAssetKind(value: Record<string, unknown>): string {
  return typeof value.assetKind === 'string' ? value.assetKind : 'location'
}

export function readNullableText(value: Record<string, unknown>, key: string): string | null {
  const field = value[key]
  return typeof field === 'string' ? field : null
}

export function parseJsonObjectResponse(responseText: string): JsonRecord {
  let jsonText = responseText.trim()
  jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')

  const firstBrace = jsonText.indexOf('{')
  const lastBrace = jsonText.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('JSON format invalid')
  }

  const parsed = JSON.parse(jsonText.substring(firstBrace, lastBrace + 1))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON payload must be an object')
  }
  return parsed as JsonRecord
}

export function parsePanelCharacters(panel: { characters: string | null } | null | undefined): string[] {
  if (!panel?.characters) return []
  try {
    const raw = JSON.parse(panel.characters)
    if (!Array.isArray(raw)) return []
    return raw
      .map((item) =>
        typeof item === 'string'
          ? item
          : typeof item === 'object' && item !== null && typeof (item as JsonRecord).name === 'string'
            ? ((item as JsonRecord).name as string)
            : '',
      )
      .filter(Boolean)
  } catch {
    return []
  }
}

export function parsePanelProps(panel: Record<string, unknown> | null | undefined): string[] {
  const rawValue = panel?.props
  if (typeof rawValue !== 'string' || !rawValue) return []
  try {
    const raw = JSON.parse(rawValue)
    if (!Array.isArray(raw)) return []
    return raw.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
  } catch {
    return []
  }
}
