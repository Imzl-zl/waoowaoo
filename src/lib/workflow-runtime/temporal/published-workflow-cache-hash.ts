import { createHash } from 'node:crypto'

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, stableJsonValue(entryValue)]),
  )
}

export function publishedWorkflowVersionHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableJsonValue(value)))
    .digest('hex')
}
