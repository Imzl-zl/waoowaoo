import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project } from '@/types/project'
import { queryKeys } from '../keys'
import type { ProjectAssetsData } from '../hooks/useProjectAssets'
import {
    requestVoidWithError,
} from './mutation-shared'
import {
    createInvalidateProjectAssetsCallback,
    removeLocationFromAssets,
    removeLocationFromProject,
    type DeleteProjectLocationContext,
} from './location-management-mutations.shared'

export {
    useAiCreateProjectLocation,
    useAiModifyProjectLocationDescription,
    useAiModifyProjectPropDescription,
    useBatchGenerateLocationImages,
    useConfirmProjectLocationSelection,
    useCreateProjectLocation,
    useUpdateProjectLocationDescription,
    useUpdateProjectLocationName,
} from './location-management-mutations.base'

export function useDeleteProjectLocation(projectId: string) {
    const queryClient = useQueryClient()
    const invalidateProjectAssets = createInvalidateProjectAssetsCallback(queryClient, projectId)

    return useMutation({
        mutationFn: async (locationId: string) => {
            await requestVoidWithError(
                `/api/novel-promotion/${projectId}/location?id=${encodeURIComponent(locationId)}`,
                { method: 'DELETE' },
                'Failed to delete location',
            )
        },
        onMutate: async (locationId): Promise<DeleteProjectLocationContext> => {
            const assetsQueryKey = queryKeys.projectAssets.all(projectId)
            const projectQueryKey = queryKeys.projectData(projectId)

            await queryClient.cancelQueries({ queryKey: assetsQueryKey })
            await queryClient.cancelQueries({ queryKey: projectQueryKey })

            const previousAssets = queryClient.getQueryData<ProjectAssetsData>(assetsQueryKey)
            const previousProject = queryClient.getQueryData<Project>(projectQueryKey)

            queryClient.setQueryData<ProjectAssetsData | undefined>(assetsQueryKey, (previous) =>
                removeLocationFromAssets(previous, locationId),
            )
            queryClient.setQueryData<Project | undefined>(projectQueryKey, (previous) =>
                removeLocationFromProject(previous, locationId),
            )

            return {
                previousAssets,
                previousProject,
            }
        },
        onError: (_error, _locationId, context) => {
            if (!context) return
            queryClient.setQueryData(queryKeys.projectAssets.all(projectId), context.previousAssets)
            queryClient.setQueryData(queryKeys.projectData(projectId), context.previousProject)
        },
        onSettled: invalidateProjectAssets,
    })
}
