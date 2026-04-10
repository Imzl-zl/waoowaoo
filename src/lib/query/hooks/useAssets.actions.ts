'use client'

import { useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-fetch'
import { resolveTaskResponse } from '@/lib/task/client'
import { queryKeys } from '@/lib/query/keys'
import {
  clearTaskTargetOverlay,
  upsertTaskTargetOverlay,
} from '@/lib/query/task-target-overlay'
import type { AssetKind } from '@/lib/assets/contracts'

type AssetActionScopeInput = {
  scope: 'global' | 'project'
  projectId?: string | null
  kind: AssetKind
}

type GenerateOverlayTarget = {
  projectId: string
  targetType: string
  targetId: string
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveGenerateOverlayTarget(
  input: AssetActionScopeInput,
  payload: Record<string, unknown>,
): GenerateOverlayTarget | null {
  const assetId = normalizeOptionalString(payload.id)
    ?? normalizeOptionalString(payload.characterId)
    ?? normalizeOptionalString(payload.locationId)
  if (!assetId) {
    return null
  }

  if (input.scope === 'global') {
    return {
      projectId: 'global-asset-hub',
      targetType: input.kind === 'character' ? 'GlobalCharacter' : 'GlobalLocation',
      targetId: assetId,
    }
  }

  const projectId = normalizeOptionalString(input.projectId)
  if (!projectId) {
    return null
  }

  if (input.kind === 'character') {
    const appearanceId = normalizeOptionalString(payload.appearanceId)
    return {
      projectId,
      targetType: 'CharacterAppearance',
      targetId: appearanceId ?? assetId,
    }
  }

  return {
    projectId,
    targetType: 'LocationImage',
    targetId: assetId,
  }
}

function invalidateScopeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  input: AssetActionScopeInput,
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.assets.all(input.scope, input.projectId),
  })
  if (input.scope === 'global') {
    queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.all() })
  } else if (input.projectId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.projectAssets.all(input.projectId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.projectData(input.projectId) })
  }
}

export function useRefreshAssets(input: { scope: 'global' | 'project'; projectId?: string | null }) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.assets.all(input.scope, input.projectId),
    })
    if (input.scope === 'global') {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.all() })
    } else if (input.projectId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectAssets.all(input.projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projectData(input.projectId) })
    }
  }
}

export function useAssetActions(input: AssetActionScopeInput) {
  const queryClient = useQueryClient()

  const create = async (payload: Record<string, unknown>) => {
    const response = await apiFetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        projectId: input.projectId,
        ...payload,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to create asset')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  const remove = async (assetId: string) => {
    const response = await apiFetch(`/api/assets/${assetId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        projectId: input.projectId,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to delete asset')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  const update = async (assetId: string, payload: Record<string, unknown>) => {
    const response = await apiFetch(`/api/assets/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        projectId: input.projectId,
        ...payload,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to update asset')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  const generate = async (payload: Record<string, unknown>) => {
    const assetId = String(payload.id)
    const overlayTarget = resolveGenerateOverlayTarget(input, payload)
    if (overlayTarget) {
      upsertTaskTargetOverlay(queryClient, {
        ...overlayTarget,
        intent: 'generate',
      })
    }

    try {
      const response = await apiFetch(`/api/assets/${assetId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: input.scope,
          kind: input.kind,
          projectId: input.projectId,
          ...payload,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to generate asset render')
      }
      invalidateScopeQueries(queryClient, input)
      return response.json()
    } catch (error) {
      if (overlayTarget) {
        clearTaskTargetOverlay(queryClient, overlayTarget)
      }
      throw error
    }
  }

  const selectRender = async (payload: Record<string, unknown>) => {
    const response = await apiFetch(`/api/assets/${String(payload.id ?? payload.characterId ?? payload.locationId)}/select-render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        projectId: input.projectId,
        ...payload,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to select asset render')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  const revertRender = async (payload: Record<string, unknown>) => {
    const response = await apiFetch(`/api/assets/${String(payload.id ?? payload.characterId ?? payload.locationId)}/revert-render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        projectId: input.projectId,
        ...payload,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to revert asset render')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  const modifyRender = async (payload: Record<string, unknown>) => {
    const response = await apiFetch(`/api/assets/${String(payload.id ?? payload.characterId ?? payload.locationId)}/modify-render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        projectId: input.projectId,
        ...payload,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to modify asset render')
    }
    const result = await resolveTaskResponse(response)
    invalidateScopeQueries(queryClient, input)
    return result
  }

  const copyFromGlobal = async (payload: { targetId: string; globalAssetId: string }) => {
    if (input.scope !== 'project' || !input.projectId) {
      throw new Error('copyFromGlobal is only available for project asset scope')
    }
    const response = await apiFetch(`/api/assets/${payload.targetId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: input.kind,
        projectId: input.projectId,
        globalAssetId: payload.globalAssetId,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to copy asset from global library')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  const bindVoice = async (payload: Record<string, unknown>) => {
    const characterId = String(payload.characterId)
    const response = await apiFetch(`/api/assets/${characterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: 'character',
        projectId: input.projectId,
        ...payload,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to bind voice')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  const updateLabel = async (assetId: string, payload: { newName: string }) => {
    const response = await apiFetch(`/api/assets/${assetId}/update-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        projectId: input.projectId,
        newName: payload.newName,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to update asset label')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  const updateVariant = async (assetId: string, variantId: string, payload: Record<string, unknown>) => {
    const response = await apiFetch(`/api/assets/${assetId}/variants/${variantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        projectId: input.projectId,
        ...payload,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to update asset variant')
    }
    invalidateScopeQueries(queryClient, input)
    return response.json()
  }

  return {
    create,
    update,
    updateVariant,
    remove,
    generate,
    selectRender,
    revertRender,
    modifyRender,
    copyFromGlobal,
    bindVoice,
    updateLabel,
  }
}
