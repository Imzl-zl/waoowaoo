import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import type { Project } from '@/types/project'
import { queryKeys } from '../keys'
import type { ProjectAssetsData } from '../hooks/useProjectAssets'
import {
    clearTaskTargetOverlay,
    upsertTaskTargetOverlay,
} from '../task-target-overlay'
import {
    invalidateQueryTemplates,
    requestJsonWithError,
    requestTaskResponseWithError,
} from './mutation-shared'
import { resolveTaskResponse } from '@/lib/task/client'
import {
    applyLocationSelectionToAssets,
    applyLocationSelectionToProject,
    createInvalidateProjectAssetsCallback,
    type SelectProjectLocationImageContext,
} from './location-image-mutations.shared'
import { buildProjectLocationGenerateImageBody } from './location-image-mutations.base'

export {
    buildProjectLocationGenerateImageBody,
    useRegenerateLocationGroup,
    useRegenerateSingleLocationImage,
    useUndoProjectLocationImage,
    useUploadProjectLocationImage,
} from './location-image-mutations.base'

export function useGenerateProjectLocationImage(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({
            locationId,
            imageIndex,
            artStyle,
            count,
        }: {
            locationId: string
            imageIndex?: number
            artStyle?: string
            count?: number
        }) => {
            return await requestJsonWithError(`/api/assets/${locationId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildProjectLocationGenerateImageBody({
                    projectId,
                    locationId,
                    imageIndex,
                    artStyle,
                    count,
                }))
            }, 'Failed to generate image')
        },
        onMutate: ({ locationId }) => {
            upsertTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'LocationImage',
                targetId: locationId,
                intent: 'generate',
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

export function useModifyProjectLocationImage(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssetAndProjectData = () =>
        invalidateQueryTemplates(queryClient, [
            queryKeys.projectAssets.all(projectId),
            queryKeys.projectData(projectId),
        ])

    return useMutation({
        mutationFn: async (params: {
            locationId: string
            imageIndex: number
            modifyPrompt: string
            extraImageUrls?: string[]
        }) => {
            const response = await requestTaskResponseWithError(`/api/assets/${params.locationId}/modify-render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'location',
                    projectId,
                    ...params,
                }),
            }, 'Failed to modify image')
            return await resolveTaskResponse(response)
        },
        onMutate: ({ locationId }) => {
            upsertTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'LocationImage',
                targetId: locationId,
                intent: 'modify',
            })
        },
        onError: (_error, { locationId }) => {
            clearTaskTargetOverlay(queryClient, {
                projectId,
                targetType: 'LocationImage',
                targetId: locationId,
            })
        },
        onSettled: invalidateProjectAssetAndProjectData,
    })
}

export function useSelectProjectLocationImage(projectId: string) {
    const queryClient = useQueryClient()
    const latestRequestIdByTargetRef = useRef<Record<string, number>>({})
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({
            locationId, imageIndex
        }: {
            locationId: string
            imageIndex: number | null
            confirm?: boolean
        }) => {
            return await requestJsonWithError(`/api/assets/${locationId}/select-render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'location',
                    projectId,
                    imageIndex,
                })
            }, 'Failed to select image')
        },
        onMutate: async (variables): Promise<SelectProjectLocationImageContext> => {
            const targetKey = variables.locationId
            const requestId = (latestRequestIdByTargetRef.current[targetKey] ?? 0) + 1
            latestRequestIdByTargetRef.current[targetKey] = requestId

            const assetsQueryKey = queryKeys.projectAssets.all(projectId)
            const projectQueryKey = queryKeys.projectData(projectId)

            await queryClient.cancelQueries({ queryKey: assetsQueryKey })
            await queryClient.cancelQueries({ queryKey: projectQueryKey })

            const previousAssets = queryClient.getQueryData<ProjectAssetsData>(assetsQueryKey)
            const previousProject = queryClient.getQueryData<Project>(projectQueryKey)

            queryClient.setQueryData<ProjectAssetsData | undefined>(assetsQueryKey, (previous) =>
                applyLocationSelectionToAssets(previous, variables.locationId, variables.imageIndex),
            )
            queryClient.setQueryData<Project | undefined>(projectQueryKey, (previous) =>
                applyLocationSelectionToProject(previous, variables.locationId, variables.imageIndex),
            )

            return {
                previousAssets,
                previousProject,
                targetKey,
                requestId,
            }
        },
        onError: (_error, _variables, context) => {
            if (!context) return
            const latestRequestId = latestRequestIdByTargetRef.current[context.targetKey]
            if (latestRequestId !== context.requestId) return
            queryClient.setQueryData(queryKeys.projectAssets.all(projectId), context.previousAssets)
            queryClient.setQueryData(queryKeys.projectData(projectId), context.previousProject)
        },
        onSettled: (_data, _error, variables) => {
            if (variables.confirm) {
                void invalidateProjectAssets()
            }
        },
    })
}
