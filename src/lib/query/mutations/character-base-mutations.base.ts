import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logError as _ulogError } from '@/lib/logging/core'
import { apiFetch } from '@/lib/api-fetch'
import {
    clearTaskTargetOverlay,
    upsertTaskTargetOverlay,
} from '../task-target-overlay'
import {
    requestJsonWithError,
    requestVoidWithError,
} from './mutation-shared'
import { createInvalidateProjectAssetsCallback } from './character-base-mutations.shared'

export function useGenerateProjectCharacterImage(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({
            characterId,
            appearanceId,
            count,
        }: {
            characterId: string
            appearanceId: string
            count?: number
        }) => {
            return await requestJsonWithError(`/api/assets/${characterId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'character',
                    projectId,
                    appearanceId,
                    count,
                }),
            }, 'Failed to generate image')
        },
        onMutate: ({ appearanceId }) => {
            upsertTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'CharacterAppearance',
                targetId: appearanceId,
                intent: 'generate',
            })
        },
        onError: (_error, { appearanceId }) => {
            clearTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'CharacterAppearance',
                targetId: appearanceId,
            })
        },
        onSettled: invalidateProjectAssets,
    })
}

export function useUploadProjectCharacterImage(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({
            file,
            characterId,
            appearanceId,
            imageIndex,
            labelText,
        }: {
            file: File
            characterId: string
            appearanceId: string
            imageIndex?: number
            labelText?: string
        }) => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', 'character')
            formData.append('id', characterId)
            formData.append('appearanceId', appearanceId)
            if (imageIndex !== undefined) formData.append('imageIndex', imageIndex.toString())
            if (labelText) formData.append('labelText', labelText)

            return await requestJsonWithError(`/api/novel-promotion/${projectId}/upload-asset-image`, {
                method: 'POST',
                body: formData,
            }, 'Failed to upload image')
        },
        onSuccess: invalidateProjectAssets,
    })
}

export function useUndoProjectCharacterImage(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({ characterId, appearanceId }: { characterId: string; appearanceId: string }) => {
            return await requestJsonWithError(`/api/assets/${characterId}/revert-render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'character',
                    projectId,
                    appearanceId,
                }),
            }, 'Failed to undo image')
        },
        onSuccess: invalidateProjectAssets,
    })
}

export function useDeleteProjectAppearance(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({ characterId, appearanceId }: { characterId: string; appearanceId: string }) => {
            await requestVoidWithError(
                `/api/novel-promotion/${projectId}/character/appearance?characterId=${encodeURIComponent(characterId)}&appearanceId=${encodeURIComponent(appearanceId)}`,
                { method: 'DELETE' },
                'Failed to delete appearance',
            )
        },
        onSuccess: invalidateProjectAssets,
    })
}

export function useUpdateProjectCharacterName(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({ characterId, name }: { characterId: string; name: string }) => {
            const res = await requestJsonWithError(`/api/assets/${characterId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'character',
                    projectId,
                    name,
                }),
            }, 'Failed to update character name')

            try {
                await apiFetch(`/api/assets/${characterId}/update-label`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scope: 'project',
                        kind: 'character',
                        projectId,
                        newName: name,
                    }),
                })
            } catch (error) {
                _ulogError('更新图片标签失败:', error)
            }

            return res
        },
        onSuccess: invalidateProjectAssets,
    })
}
