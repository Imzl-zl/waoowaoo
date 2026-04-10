export function parseStoredPayloadArrayOrThrow(
  raw: string | null | undefined,
  createError: () => Error,
): unknown[] {
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw createError()
  }
  if (!Array.isArray(parsed)) {
    throw createError()
  }
  return parsed
}

export function parseStoredPayloadArrayOrNull(raw: string | null | undefined): unknown[] | null {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

