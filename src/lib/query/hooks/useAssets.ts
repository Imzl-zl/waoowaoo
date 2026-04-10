'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-fetch'
import { queryKeys } from '@/lib/query/keys'
import { useTaskTargetStateMap } from '@/lib/query/hooks/useTaskTargetStateMap'
import type {
  AssetQueryInput,
  AssetRenderSummary,
  AssetSummary,
  AssetTaskRef,
  AssetTaskState,
  AssetVariantSummary,
  CharacterAssetSummary,
  LocationAssetSummary,
  PropAssetSummary,
  ReadAssetsResponse,
  VoiceAssetSummary,
} from '@/lib/assets/contracts'
export { useAssetActions, useRefreshAssets } from './useAssets.actions'

function flattenTaskRefs(assets: AssetSummary[]): AssetTaskRef[] {
  const refs: AssetTaskRef[] = []
  for (const asset of assets) {
    refs.push(...asset.taskRefs)
    if (asset.kind === 'voice') {
      continue
    }
    if (asset.kind === 'character') {
      refs.push(...asset.profileTaskRefs)
    }
    for (const variant of asset.variants) {
      refs.push(...variant.taskRefs)
      for (const render of variant.renders) {
        refs.push(...render.taskRefs)
      }
    }
  }
  return refs
}

function createTaskState(isRunning: boolean, lastError: { code: string; message: string } | null): AssetTaskState {
  return {
    isRunning,
    lastError,
  }
}

function resolveTaskState(refs: AssetTaskRef[], byKey: Map<string, { phase: string | null; lastError: { code: string; message: string } | null }>): AssetTaskState {
  let isRunning = false
  let lastError: { code: string; message: string } | null = null
  for (const ref of refs) {
    const state = byKey.get(`${ref.targetType}:${ref.targetId}`)
    if (!state) continue
    if (state.phase === 'queued' || state.phase === 'processing') {
      isRunning = true
    }
    if (!lastError && state.lastError) {
      lastError = state.lastError
    }
  }
  return createTaskState(isRunning, lastError)
}

function withTaskState(render: AssetRenderSummary, byKey: Map<string, { phase: string | null; lastError: { code: string; message: string } | null }>): AssetRenderSummary {
  return {
    ...render,
    taskState: resolveTaskState(render.taskRefs, byKey),
  }
}

function withTaskStateVariant(variant: AssetVariantSummary, byKey: Map<string, { phase: string | null; lastError: { code: string; message: string } | null }>): AssetVariantSummary {
  return {
    ...variant,
    renders: variant.renders.map((render) => withTaskState(render, byKey)),
    taskState: resolveTaskState(variant.taskRefs, byKey),
  }
}

function withTaskStateAsset(asset: AssetSummary, byKey: Map<string, { phase: string | null; lastError: { code: string; message: string } | null }>): AssetSummary {
  if (asset.kind === 'voice') {
    const voiceAsset: VoiceAssetSummary = {
      ...asset,
      taskState: resolveTaskState(asset.taskRefs, byKey),
    }
    return voiceAsset
  }

  const variants = asset.variants.map((variant) => withTaskStateVariant(variant, byKey))
  if (asset.kind === 'character') {
    const characterAsset: CharacterAssetSummary = {
      ...asset,
      variants,
      taskState: resolveTaskState(asset.taskRefs, byKey),
      profileTaskState: resolveTaskState(asset.profileTaskRefs, byKey),
    }
    return characterAsset
  }

  if (asset.kind === 'location') {
    const locationAsset: LocationAssetSummary = {
      ...asset,
      variants,
      taskState: resolveTaskState(asset.taskRefs, byKey),
    }
    return locationAsset
  }

  const propAsset: PropAssetSummary = {
    ...asset,
    variants,
    taskState: resolveTaskState(asset.taskRefs, byKey),
  }
  return propAsset
}

function buildQueryPath(input: AssetQueryInput): string {
  const searchParams = new URLSearchParams({
    scope: input.scope,
  })
  if (input.projectId) {
    searchParams.set('projectId', input.projectId)
  }
  if (input.folderId) {
    searchParams.set('folderId', input.folderId)
  }
  if (input.kind) {
    searchParams.set('kind', input.kind)
  }
  return `/api/assets?${searchParams.toString()}`
}

export function useAssets(input: AssetQueryInput) {
  const assetsQuery = useQuery({
    queryKey: queryKeys.assets.list(input),
    queryFn: async () => {
      const response = await apiFetch(buildQueryPath(input))
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json() as ReadAssetsResponse
      return data.assets
    },
    enabled: input.scope === 'global' || !!input.projectId,
    staleTime: 5_000,
  })

  const taskProjectId = input.scope === 'global' ? 'global-asset-hub' : input.projectId ?? ''
  const taskRefs = useMemo(() => flattenTaskRefs(assetsQuery.data ?? []), [assetsQuery.data])
  const taskTargets = useMemo(() => taskRefs.map((ref) => ({
    targetType: ref.targetType,
    targetId: ref.targetId,
    types: ref.types,
  })), [taskRefs])
  const taskStatesQuery = useTaskTargetStateMap(taskProjectId, taskTargets, {
    enabled: taskProjectId.length > 0 && taskTargets.length > 0,
  })

  const data = useMemo(() => {
    const assets = assetsQuery.data ?? []
    return assets.map((asset) => withTaskStateAsset(asset, taskStatesQuery.byKey))
  }, [assetsQuery.data, taskStatesQuery.byKey])

  return {
    ...assetsQuery,
    data,
    isFetching: assetsQuery.isFetching || taskStatesQuery.isFetching,
  }
}
