import type { QueryClient } from '@tanstack/react-query'
import type { Character, Project } from '@/types/project'
import { queryKeys } from '../keys'
import type { ProjectAssetsData } from '../hooks/useProjectAssets'
import { invalidateQueryTemplates } from './mutation-shared'

export interface SelectProjectCharacterImageContext {
    previousAssets: ProjectAssetsData | undefined
    previousProject: Project | undefined
    targetKey: string
    requestId: number
}

export interface DeleteProjectCharacterContext {
    previousAssets: ProjectAssetsData | undefined
    previousProject: Project | undefined
}

function applyCharacterSelectionToCharacters(
    characters: Character[],
    characterId: string,
    appearanceId: string,
    selectedIndex: number | null,
): Character[] {
    return characters.map((character) => {
        if (character.id !== characterId) return character
        return {
            ...character,
            appearances: (character.appearances || []).map((appearance) => {
                if (appearance.id !== appearanceId) return appearance
                const selectedUrl =
                    selectedIndex !== null && selectedIndex >= 0
                        ? (appearance.imageUrls[selectedIndex] ?? null)
                        : null
                return {
                    ...appearance,
                    selectedIndex,
                    imageUrl: selectedUrl ?? appearance.imageUrl ?? null,
                }
            }),
        }
    })
}

export function applyCharacterSelectionToAssets(
    previous: ProjectAssetsData | undefined,
    characterId: string,
    appearanceId: string,
    selectedIndex: number | null,
): ProjectAssetsData | undefined {
    if (!previous) return previous
    return {
        ...previous,
        characters: applyCharacterSelectionToCharacters(
            previous.characters || [],
            characterId,
            appearanceId,
            selectedIndex,
        ),
    }
}

export function applyCharacterSelectionToProject(
    previous: Project | undefined,
    characterId: string,
    appearanceId: string,
    selectedIndex: number | null,
): Project | undefined {
    if (!previous?.novelPromotionData) return previous
    const currentCharacters = previous.novelPromotionData.characters || []
    return {
        ...previous,
        novelPromotionData: {
            ...previous.novelPromotionData,
            characters: applyCharacterSelectionToCharacters(
                currentCharacters,
                characterId,
                appearanceId,
                selectedIndex,
            ),
        },
    }
}

export function removeCharacterFromAssets(
    previous: ProjectAssetsData | undefined,
    characterId: string,
): ProjectAssetsData | undefined {
    if (!previous) return previous
    return {
        ...previous,
        characters: (previous.characters || []).filter((character) => character.id !== characterId),
    }
}

export function removeCharacterFromProject(
    previous: Project | undefined,
    characterId: string,
): Project | undefined {
    if (!previous?.novelPromotionData) return previous
    const currentCharacters = previous.novelPromotionData.characters || []
    return {
        ...previous,
        novelPromotionData: {
            ...previous.novelPromotionData,
            characters: currentCharacters.filter((character) => character.id !== characterId),
        },
    }
}

export function createInvalidateProjectAssetsCallback(queryClient: QueryClient, projectId: string) {
    return () => invalidateQueryTemplates(queryClient, [queryKeys.projectAssets.all(projectId)])
}
