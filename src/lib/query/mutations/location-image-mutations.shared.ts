import type { QueryClient } from '@tanstack/react-query'
import type { Location, Project } from '@/types/project'
import { queryKeys } from '../keys'
import type { ProjectAssetsData } from '../hooks/useProjectAssets'
import { invalidateQueryTemplates } from './mutation-shared'

export interface SelectProjectLocationImageContext {
    previousAssets: ProjectAssetsData | undefined
    previousProject: Project | undefined
    targetKey: string
    requestId: number
}

function applyLocationSelectionToLocations(
    locations: Location[],
    locationId: string,
    selectedIndex: number | null,
): Location[] {
    return locations.map((location) => {
        if (location.id !== locationId) return location
        const selectedImageId =
            selectedIndex === null
                ? null
                : (location.images || []).find((image) => image.imageIndex === selectedIndex)?.id ?? null
        return {
            ...location,
            selectedImageId,
            images: (location.images || []).map((image) => ({
                ...image,
                isSelected: selectedIndex !== null && image.imageIndex === selectedIndex,
            })),
        }
    })
}

export function applyLocationSelectionToAssets(
    previous: ProjectAssetsData | undefined,
    locationId: string,
    selectedIndex: number | null,
): ProjectAssetsData | undefined {
    if (!previous) return previous
    return {
        ...previous,
        locations: applyLocationSelectionToLocations(previous.locations || [], locationId, selectedIndex),
    }
}

export function applyLocationSelectionToProject(
    previous: Project | undefined,
    locationId: string,
    selectedIndex: number | null,
): Project | undefined {
    if (!previous?.novelPromotionData) return previous
    const currentLocations = previous.novelPromotionData.locations || []
    return {
        ...previous,
        novelPromotionData: {
            ...previous.novelPromotionData,
            locations: applyLocationSelectionToLocations(currentLocations, locationId, selectedIndex),
        },
    }
}

export function createInvalidateProjectAssetsCallback(queryClient: QueryClient, projectId: string) {
    return () => invalidateQueryTemplates(queryClient, [queryKeys.projectAssets.all(projectId)])
}
