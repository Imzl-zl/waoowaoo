import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import type { Project } from '@/types/project'
import { queryKeys } from '../keys'
import type { ProjectAssetsData } from '../hooks/useProjectAssets'
import {
    requestJsonWithError,
    requestVoidWithError,
} from './mutation-shared'
import {
    applyCharacterSelectionToAssets,
    applyCharacterSelectionToProject,
    createInvalidateProjectAssetsCallback,
    removeCharacterFromAssets,
    removeCharacterFromProject,
    type DeleteProjectCharacterContext,
    type SelectProjectCharacterImageContext,
} from './character-base-mutations.shared'

export {
    useDeleteProjectAppearance,
    useGenerateProjectCharacterImage,
    useUndoProjectCharacterImage,
    useUpdateProjectCharacterName,
    useUploadProjectCharacterImage,
} from './character-base-mutations.base'

export function useSelectProjectCharacterImage(projectId: string) {
    const queryClient = useQueryClient()
    const latestRequestIdByTargetRef = useRef<Record<string, number>>({})
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async ({
            characterId, appearanceId, imageIndex
        }: {
            characterId: string
            appearanceId: string
            imageIndex: number | null
            confirm?: boolean
        }) => {
            return await requestJsonWithError(`/api/assets/${characterId}/select-render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'project',
                    kind: 'character',
                    projectId,
                    appearanceId,
                    imageIndex,
                })
            }, 'Failed to select image')
        },
        onMutate: async (variables): Promise<SelectProjectCharacterImageContext> => {
            const targetKey = `${variables.characterId}:${variables.appearanceId}`
            const requestId = (latestRequestIdByTargetRef.current[targetKey] ?? 0) + 1
            latestRequestIdByTargetRef.current[targetKey] = requestId

            const assetsQueryKey = queryKeys.projectAssets.all(projectId)
            const projectQueryKey = queryKeys.projectData(projectId)

            await queryClient.cancelQueries({ queryKey: assetsQueryKey })
            await queryClient.cancelQueries({ queryKey: projectQueryKey })

            const previousAssets = queryClient.getQueryData<ProjectAssetsData>(assetsQueryKey)
            const previousProject = queryClient.getQueryData<Project>(projectQueryKey)

            queryClient.setQueryData<ProjectAssetsData | undefined>(assetsQueryKey, (previous) =>
                applyCharacterSelectionToAssets(previous, variables.characterId, variables.appearanceId, variables.imageIndex),
            )
            queryClient.setQueryData<Project | undefined>(projectQueryKey, (previous) =>
                applyCharacterSelectionToProject(previous, variables.characterId, variables.appearanceId, variables.imageIndex),
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

export function useDeleteProjectCharacter(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async (characterId: string) => {
            await requestVoidWithError(
                `/api/novel-promotion/${projectId}/character?id=${encodeURIComponent(characterId)}`,
                { method: 'DELETE' },
                'Failed to delete character',
            )
        },
        onMutate: async (characterId): Promise<DeleteProjectCharacterContext> => {
            const assetsQueryKey = queryKeys.projectAssets.all(projectId)
            const projectQueryKey = queryKeys.projectData(projectId)

            await queryClient.cancelQueries({ queryKey: assetsQueryKey })
            await queryClient.cancelQueries({ queryKey: projectQueryKey })

            const previousAssets = queryClient.getQueryData<ProjectAssetsData>(assetsQueryKey)
            const previousProject = queryClient.getQueryData<Project>(projectQueryKey)

            queryClient.setQueryData<ProjectAssetsData | undefined>(assetsQueryKey, (previous) =>
                removeCharacterFromAssets(previous, characterId),
            )
            queryClient.setQueryData<Project | undefined>(projectQueryKey, (previous) =>
                removeCharacterFromProject(previous, characterId),
            )

            return {
                previousAssets,
                previousProject,
            }
        },
        onError: (_error, _characterId, context) => {
            if (!context) return
            queryClient.setQueryData(queryKeys.projectAssets.all(projectId), context.previousAssets)
            queryClient.setQueryData(queryKeys.projectData(projectId), context.previousProject)
        },
        onSettled: invalidateProjectAssets,
    })
}
