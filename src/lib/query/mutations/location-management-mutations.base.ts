import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logError as _ulogError } from '@/lib/logging/core'
import type { LocationAvailableSlot } from '@/lib/location-available-slots'
import { resolveTaskResponse } from '@/lib/task/client'
import { apiFetch } from '@/lib/api-fetch'
import {
    clearTaskTargetOverlay,
    upsertTaskTargetOverlay,
} from '../task-target-overlay'
import {
    requestJsonWithError,
    requestTaskResponseWithError,
} from './mutation-shared'
import { createInvalidateProjectAssetsCallback } from './location-management-mutations.shared'

export function useUpdateProjectLocationName(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({ locationId, name }: { locationId: string; name: string }) => {
            const res = await requestJsonWithError(`/api/assets/${locationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'location',
                    projectId,
                    name,
                }),
            }, 'Failed to update location name')

            try {
                await apiFetch(`/api/assets/${locationId}/update-label`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scope: 'project',
                        kind: 'location',
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

export function useUpdateProjectLocationDescription(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({
            locationId,
            description,
            imageIndex,
            availableSlots,
        }: {
            locationId: string
            description: string
            imageIndex?: number
            availableSlots?: LocationAvailableSlot[]
        }) => {
            return await requestJsonWithError(`/api/novel-promotion/${projectId}/location`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationId,
                    imageIndex: typeof imageIndex === 'number' ? imageIndex : 0,
                    description,
                    ...(availableSlots ? { availableSlots } : {}),
                }),
            }, 'Failed to update location description')
        },
        onSuccess: invalidateProjectAssets,
    })
}

export function useAiModifyProjectLocationDescription(projectId: string) {
    return useMutation({
        mutationFn: async ({
            locationId,
            currentDescription,
            modifyInstruction,
            imageIndex,
        }: {
            locationId: string
            currentDescription: string
            modifyInstruction: string
            imageIndex?: number
        }) => {
            const response = await requestTaskResponseWithError(
                `/api/novel-promotion/${projectId}/ai-modify-location`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        locationId,
                        imageIndex: typeof imageIndex === 'number' ? imageIndex : 0,
                        currentDescription,
                        modifyInstruction,
                    }),
                },
                'Failed to modify location description',
            )
            return resolveTaskResponse<{
                prompt?: string
                modifiedDescription?: string
                availableSlots?: LocationAvailableSlot[]
            }>(response)
        },
    })
}

export function useAiModifyProjectPropDescription(projectId: string) {
    return useMutation({
        mutationFn: async ({
            propId,
            variantId,
            currentDescription,
            modifyInstruction,
        }: {
            propId: string
            variantId?: string
            currentDescription: string
            modifyInstruction: string
        }) => {
            const response = await requestTaskResponseWithError(
                `/api/novel-promotion/${projectId}/ai-modify-prop`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        propId,
                        variantId,
                        currentDescription,
                        modifyInstruction,
                    }),
                },
                'Failed to modify prop description',
            )
            return resolveTaskResponse<{ modifiedDescription?: string }>(response)
        },
    })
}

export function useAiCreateProjectLocation(projectId: string) {
    return useMutation({
        mutationFn: async (payload: { userInstruction: string }) => {
            const response = await requestTaskResponseWithError(
                `/api/novel-promotion/${projectId}/ai-create-location`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
                'Failed to design location',
            )
            return await resolveTaskResponse<{ prompt?: string; availableSlots?: LocationAvailableSlot[] }>(response)
        },
    })
}

export function useCreateProjectLocation(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async (payload: {
            name: string
            description: string
            artStyle?: string
            count?: number
            availableSlots?: LocationAvailableSlot[]
        }) =>
            await requestJsonWithError(
                `/api/novel-promotion/${projectId}/location`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
                'Failed to create location',
            ),
        onSuccess: invalidateProjectAssets,
    })
}

export function useConfirmProjectLocationSelection(
    projectId: string,
    kind: 'location' | 'prop' = 'location',
) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({ locationId }: { locationId: string }) =>
            await requestJsonWithError(
                `/api/assets/${locationId}/select-render`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scope: 'project',
                        kind,
                        projectId,
                        confirm: true,
                    }),
                },
                '确认选择失败',
            ),
        onSettled: invalidateProjectAssets,
    })
}

export function useBatchGenerateLocationImages(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async (locationIds: string[]) => {
            const results = await Promise.allSettled(
                locationIds.map((locationId) =>
                    apiFetch(`/api/assets/${locationId}/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            scope: 'project',
                            kind: 'location',
                            projectId,
                        }),
                    }),
                ),
            )
            return results
        },
        onMutate: (locationIds) => {
            for (const locationId of locationIds) {
                upsertTaskTargetOverlay(queryClient, {
                    projectId,
                    targetType: 'LocationImage',
                    targetId: locationId,
                    intent: 'generate',
                })
            }
        },
        onError: (_error, locationIds) => {
            for (const locationId of locationIds) {
                clearTaskTargetOverlay(queryClient, {
                    projectId,
                    targetType: 'LocationImage',
                    targetId: locationId,
                })
            }
        },
        onSettled: invalidateProjectAssets,
    })
}
