import { safeParseJsonObject } from '@/lib/json-repair'
import { prisma } from '@/lib/prisma'
import { removeLocationPromptSuffix } from '@/lib/constants'
import { seedProjectLocationBackedImageSlots } from '@/lib/assets/services/location-backed-assets'
import { normalizeLocationAvailableSlots } from '@/lib/location-available-slots'
import { resolvePropVisualDescription } from '@/lib/assets/prop-description'

export function readAssetKind(value: Record<string, unknown>): string {
  return typeof value.assetKind === 'string' ? value.assetKind : 'location'
}

export function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

export function nameMatchesWithAlias(existingName: string, newName: string): boolean {
  const a = existingName.toLowerCase().trim()
  const b = newName.toLowerCase().trim()
  if (a === b) return true
  const aliasesA = a.split('/').map((item) => item.trim()).filter(Boolean)
  const aliasesB = b.split('/').map((item) => item.trim()).filter(Boolean)
  return aliasesB.some((alias) => aliasesA.includes(alias))
}

export function parseJsonResponse(responseText: string): Record<string, unknown> {
  return safeParseJsonObject(responseText)
}

export async function createAnalyzedCharacters(input: {
  novelPromotionProjectId: string
  existingCharacters: Array<{ name: string }>
  parsedCharacters: Array<Record<string, unknown>>
}) {
  const createdCharacters: Array<{ id: string }> = []

  for (const item of input.parsedCharacters) {
    const name = readText(item.name).trim()
    if (!name) continue

    const existsInLibrary = input.existingCharacters.some((character) => nameMatchesWithAlias(character.name, name))
    if (existsInLibrary) continue

    const profileData = {
      role_level: item.role_level,
      archetype: item.archetype,
      personality_tags: toStringArray(item.personality_tags),
      era_period: item.era_period,
      social_class: item.social_class,
      occupation: item.occupation,
      costume_tier: item.costume_tier,
      suggested_colors: toStringArray(item.suggested_colors),
      primary_identifier: item.primary_identifier,
      visual_keywords: toStringArray(item.visual_keywords),
      gender: item.gender,
      age_range: item.age_range,
    }

    const created = await prisma.novelPromotionCharacter.create({
      data: {
        novelPromotionProjectId: input.novelPromotionProjectId,
        name,
        aliases: JSON.stringify(toStringArray(item.aliases)),
        profileData: JSON.stringify(profileData),
        profileConfirmed: false,
      },
      select: { id: true },
    })
    createdCharacters.push(created)
  }

  return createdCharacters
}

export async function createAnalyzedLocations(input: {
  novelPromotionProjectId: string
  existingLocations: Array<Record<string, unknown> & { name: string }>
  parsedLocations: Array<Record<string, unknown>>
}) {
  const invalidKeywords = ['幻想', '抽象', '无明确', '空间锚点', '未说明', '不明确']
  const createdLocations: Array<{ id: string }> = []

  for (const item of input.parsedLocations) {
    const name = readText(item.name).trim()
    if (!name) continue

    const descriptionsRaw = Array.isArray(item.descriptions)
      ? (item.descriptions as unknown[])
      : (readText(item.description) ? [readText(item.description)] : [])
    const descriptions = descriptionsRaw.map((value) => readText(value)).filter(Boolean)
    const firstDescription = descriptions[0] || ''
    const isInvalid = invalidKeywords.some((keyword) => name.includes(keyword) || firstDescription.includes(keyword))
    if (isInvalid) continue

    const existsInLibrary = input.existingLocations.some(
      (location) => readAssetKind(location) !== 'prop' && nameMatchesWithAlias(location.name, name),
    )
    if (existsInLibrary) continue

    const created = await prisma.novelPromotionLocation.create({
      data: {
        novelPromotionProjectId: input.novelPromotionProjectId,
        name,
        summary: readText(item.summary) || null,
      },
      select: { id: true },
    })

    const cleanDescriptions = descriptions.map((value) => removeLocationPromptSuffix(value || ''))
    const availableSlots = normalizeLocationAvailableSlots(item.available_slots)
    await seedProjectLocationBackedImageSlots({
      locationId: created.id,
      descriptions: cleanDescriptions,
      fallbackDescription: readText(item.summary) || name,
      availableSlots,
    })

    createdLocations.push(created)
  }

  return createdLocations
}

export async function createAnalyzedProps(input: {
  novelPromotionProjectId: string
  existingLocations: Array<Record<string, unknown> & { name: string }>
  parsedProps: Array<Record<string, unknown>>
}) {
  const existingPropNameSet = new Set(
    input.existingLocations
      .filter((item) => readAssetKind(item) === 'prop')
      .map((item) => item.name.toLowerCase()),
  )
  const createdProps: Array<{ id: string }> = []

  for (const item of input.parsedProps) {
    const name = readText(item.name).trim()
    const summary = readText(item.summary).trim()
    const description = resolvePropVisualDescription({
      name,
      summary,
      description: readText(item.description).trim(),
    })
    if (!name || !summary || !description) continue

    const normalizedName = name.toLowerCase()
    if (existingPropNameSet.has(normalizedName)) continue

    const created = await prisma.novelPromotionLocation.create({
      data: {
        novelPromotionProjectId: input.novelPromotionProjectId,
        name,
        summary,
        assetKind: 'prop',
      },
      select: { id: true },
    })
    await seedProjectLocationBackedImageSlots({
      locationId: created.id,
      descriptions: [description],
      fallbackDescription: description,
      availableSlots: [],
    })
    existingPropNameSet.add(normalizedName)
    createdProps.push(created)
  }

  return createdProps
}
