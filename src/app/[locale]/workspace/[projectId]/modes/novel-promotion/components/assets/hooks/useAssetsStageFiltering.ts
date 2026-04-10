'use client'

import { useMemo, useState } from 'react'
import type { NovelPromotionClip } from '@/types/project'
import type {
  CharacterAssetSummary,
  LocationAssetSummary,
  PropAssetSummary,
} from '@/lib/assets/contracts'
import { useEpisodes, useEpisodeData } from '@/lib/query/hooks'
import { fuzzyMatchLocation, getAllClipsAssets } from '../../script-view/clip-asset-utils'

interface UseAssetsStageFilteringParams {
  projectId: string
  characters: CharacterAssetSummary[]
  locations: LocationAssetSummary[]
  props: PropAssetSummary[]
}

export function useAssetsStageFiltering({
  projectId,
  characters,
  locations,
  props,
}: UseAssetsStageFilteringParams) {
  const [episodeFilter, setEpisodeFilter] = useState<string | null>(null)

  const totalAppearances = characters.reduce(
    (sum, character) => sum + character.variants.length,
    0,
  )
  const totalLocations = locations.length
  const totalProps = props.length
  const totalAssets = totalAppearances + totalLocations + totalProps

  const { episodes } = useEpisodes(projectId)
  const episodeOptions = useMemo(
    () => episodes.map((episode) => ({
      id: episode.id,
      episodeNumber: episode.episodeNumber,
      name: episode.name,
    })),
    [episodes],
  )

  const { data: episodeData } = useEpisodeData(projectId, episodeFilter)
  const episodeClips = useMemo(() => {
    if (!episodeFilter || !episodeData) return null
    return ((episodeData as { clips?: NovelPromotionClip[] }).clips) ?? null
  }, [episodeData, episodeFilter])

  const episodeAssetIds = useMemo(() => {
    if (!episodeClips) return null
    const { allCharNames, allLocNames, allPropNames } = getAllClipsAssets(episodeClips)

    const charIds = new Set(
      characters
        .filter((character) => {
          const aliases = character.name.split('/').map((alias) => alias.trim())
          return (
            aliases.some((alias) => allCharNames.has(alias)) ||
            allCharNames.has(character.name)
          )
        })
        .map((character) => character.id),
    )

    const locIds = new Set(
      locations
        .filter((location) =>
          Array.from(allLocNames).some((clipLocName) =>
            fuzzyMatchLocation(clipLocName, location.name),
          ))
        .map((location) => location.id),
    )

    const propIds = new Set(
      props
        .filter((prop) =>
          Array.from(allPropNames).some(
            (clipPropName) => clipPropName.toLowerCase() === prop.name.toLowerCase(),
          ))
        .map((prop) => prop.id),
    )

    return { charIds, locIds, propIds }
  }, [characters, episodeClips, locations, props])

  const filteredCharacters = useMemo(
    () =>
      episodeAssetIds
        ? characters.filter((character) => episodeAssetIds.charIds.has(character.id))
        : characters,
    [characters, episodeAssetIds],
  )
  const filteredLocations = useMemo(
    () =>
      episodeAssetIds
        ? locations.filter((location) => episodeAssetIds.locIds.has(location.id))
        : locations,
    [episodeAssetIds, locations],
  )
  const filteredProps = useMemo(
    () =>
      episodeAssetIds
        ? props.filter((prop) => episodeAssetIds.propIds.has(prop.id))
        : props,
    [episodeAssetIds, props],
  )

  const filteredAppearances = filteredCharacters.reduce(
    (sum, character) => sum + character.variants.length,
    0,
  )
  const filteredLocCount = filteredLocations.length
  const filteredPropCount = filteredProps.length
  const filteredTotal = filteredAppearances + filteredLocCount + filteredPropCount

  return {
    episodeFilter,
    setEpisodeFilter,
    episodeAssetIds,
    episodeOptions,
    totalAppearances,
    totalLocations,
    totalProps,
    totalAssets,
    filteredCharacters,
    filteredLocations,
    filteredProps,
    filteredAppearances,
    filteredLocCount,
    filteredPropCount,
    filteredTotal,
  }
}
