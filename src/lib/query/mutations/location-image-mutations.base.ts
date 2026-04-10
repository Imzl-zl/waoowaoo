import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    clearTaskTargetOverlay,
    upsertTaskTargetOverlay,
} from '../task-target-overlay'
import {
    requestJsonWithError,
} from './mutation-shared'
import { createInvalidateProjectAssetsCallback } from './location-image-mutations.shared'

export function buildProjectLocationGenerateImageBody(input: {
    projectId: string
    locationId: string
    imageIndex?: number
    artStyle?: string
    count?: number
}) {
    return {
        scope: 'project' as const,
        kind: 'location' as const,
        projectId: input.projectId,
        imageIndex: input.imageIndex,
        artStyle: input.artStyle,
        count: input.count,
    }
}

export function useUploadProjectLocationImage(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({
            file,
            locationId,
            imageIndex,
            labelText,
        }: {
            file: File
            locationId: string
            imageIndex?: number
            labelText?: string
        }) => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', 'location')
            formData.append('id', locationId)
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

export function useRegenerateLocationGroup(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({ locationId, count }: { locationId: string; count?: number }) => {
            return await requestJsonWithError(`/api/assets/${locationId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'location',
                    projectId,
                    count,
                }),
            }, 'Failed to regenerate group')
        },
        onMutate: ({ locationId }) => {
            upsertTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'LocationImage',
                targetId: locationId,
                intent: 'regenerate',
            })
        },
        onError: (_error, { locationId }) => {
            clearTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'LocationImage',
                targetId: locationId,
            })
        },
        onSettled: invalidateProjectAssets,
    })
}

export function useRegenerateSingleLocationImage(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({ locationId, imageIndex }: { locationId: string; imageIndex: number }) => {
            return await requestJsonWithError(`/api/assets/${locationId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'location',
                    projectId,
                    imageIndex,
                }),
            }, 'Failed to regenerate image')
        },
        onMutate: ({ locationId }) => {
            upsertTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'LocationImage',
                targetId: locationId,
                intent: 'regenerate',
            })
        },
        onError: (_error, { locationId }) => {
            clearTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'LocationImage',
                targetId: locationId,
            })
        },
        onSettled: invalidateProjectAssets,
    })
}

export function useUndoProjectLocationImage(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async (locationId: string) => {
            return await requestJsonWithError(`/api/assets/${locationId}/revert-render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'location',
                    projectId,
                }),
            }, 'Failed to undo image')
        },
        onSuccess: invalidateProjectAssets,
    })
}
