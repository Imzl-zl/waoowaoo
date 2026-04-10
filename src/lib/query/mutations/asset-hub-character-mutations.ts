import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import {
  clearTaskTargetOverlay,
  upsertTaskTargetOverlay,
} from '../task-target-overlay'
import { queryKeys } from '../keys'
import type { GlobalCharacter } from '../hooks/useGlobalAssets'
import {
  requestJsonWithError,
  requestVoidWithError,
} from './mutation-shared'
import { GLOBAL_ASSET_PROJECT_ID } from './asset-hub-mutations-shared'
import {
  applyCharacterSelection,
  captureCharacterQuerySnapshots,
  createInvalidateGlobalCharactersCallback,
  restoreCharacterQuerySnapshots,
  type DeleteCharacterContext,
  type SelectCharacterImageContext,
} from './asset-hub-character-mutations.shared'

export {
  useDeleteCharacterAppearance,
  useUndoCharacterImage,
  useUploadCharacterImage,
  useUploadCharacterVoice,
} from './asset-hub-character-mutations.base'

export function useGenerateCharacterImage() {
  const queryClient = useQueryClient()
  const invalidateCharacters = createInvalidateGlobalCharactersCallback(queryClient)

  return useMutation({
    mutationFn: async ({
      characterId,
      appearanceIndex,
      artStyle,
      count,
    }: {
      characterId: string
      appearanceIndex: number
      artStyle?: string
      count?: number
    }) => {
      return await requestJsonWithError(`/api/assets/${characterId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'global',
          kind: 'character',
          appearanceIndex,
          artStyle,
          count,
        }),
      }, 'Failed to generate image')
    },
    onMutate: ({ characterId }) => {
      upsertTaskTargetOverlay(queryClient, {
        projectId: GLOBAL_ASSET_PROJECT_ID,
        targetType: 'GlobalCharacter',
        targetId: characterId,
        intent: 'generate',
      })
    },
    onError: (_error, { characterId }) => {
      clearTaskTargetOverlay(queryClient, {
        projectId: GLOBAL_ASSET_PROJECT_ID,
        targetType: 'GlobalCharacter',
        targetId: characterId,
      })
    },
    onSettled: invalidateCharacters,
  })
}

export function useModifyCharacterImage() {
  const queryClient = useQueryClient()
  const invalidateCharacters = createInvalidateGlobalCharactersCallback(queryClient)

  return useMutation({
    mutationFn: async ({
      characterId,
      appearanceIndex,
      imageIndex,
      modifyPrompt,
      extraImageUrls,
    }: {
      characterId: string
      appearanceIndex: number
      imageIndex: number
      modifyPrompt: string
      extraImageUrls?: string[]
    }) => {
      return await requestJsonWithError(`/api/assets/${characterId}/modify-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'global',
          kind: 'character',
          appearanceIndex,
          imageIndex,
          modifyPrompt,
          extraImageUrls,
        }),
      }, 'Failed to modify image')
    },
    onMutate: ({ characterId, appearanceIndex, imageIndex }) => {
      upsertTaskTargetOverlay(queryClient, {
        projectId: GLOBAL_ASSET_PROJECT_ID,
        targetType: 'GlobalCharacterAppearance',
        targetId: `${characterId}:${appearanceIndex}:${imageIndex}`,
        intent: 'modify',
      })
    },
    onError: (_error, { characterId, appearanceIndex, imageIndex }) => {
      clearTaskTargetOverlay(queryClient, {
        projectId: GLOBAL_ASSET_PROJECT_ID,
        targetType: 'GlobalCharacterAppearance',
        targetId: `${characterId}:${appearanceIndex}:${imageIndex}`,
      })
    },
    onSettled: invalidateCharacters,
  })
}

export function useSelectCharacterImage() {
  const queryClient = useQueryClient()
  const latestRequestIdByTargetRef = useRef<Record<string, number>>({})
  const invalidateCharacters = createInvalidateGlobalCharactersCallback(queryClient)

  return useMutation({
    mutationFn: async ({
      characterId,
      appearanceIndex,
      imageIndex,
      confirm = false,
    }: {
      characterId: string
      appearanceIndex: number
      imageIndex: number | null
      confirm?: boolean
    }) => {
      return await requestJsonWithError(`/api/assets/${characterId}/select-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'global',
          kind: 'character',
          appearanceIndex,
          imageIndex,
          confirm,
        }),
      }, 'Failed to select image')
    },
    onMutate: async (variables): Promise<SelectCharacterImageContext> => {
      const targetKey = `${variables.characterId}:${variables.appearanceIndex}`
      const requestId = (latestRequestIdByTargetRef.current[targetKey] ?? 0) + 1
      latestRequestIdByTargetRef.current[targetKey] = requestId

      await queryClient.cancelQueries({
        queryKey: queryKeys.globalAssets.characters(),
        exact: false,
      })
      const previousQueries = captureCharacterQuerySnapshots(queryClient)

      queryClient.setQueriesData<GlobalCharacter[] | undefined>(
        {
          queryKey: queryKeys.globalAssets.characters(),
          exact: false,
        },
        (previous) => applyCharacterSelection(
          previous,
          variables.characterId,
          variables.appearanceIndex,
          variables.imageIndex,
        ),
      )

      return {
        previousQueries,
        targetKey,
        requestId,
      }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      const latestRequestId = latestRequestIdByTargetRef.current[context.targetKey]
      if (latestRequestId !== context.requestId) return
      restoreCharacterQuerySnapshots(queryClient, context.previousQueries)
    },
    onSettled: (_data, _error, variables) => {
      if (variables.confirm) {
        void invalidateCharacters()
      }
    },
  })
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient()
  const invalidateCharacters = createInvalidateGlobalCharactersCallback(queryClient)

  return useMutation({
    mutationFn: async (characterId: string) => {
      await requestVoidWithError(
        `/api/asset-hub/characters/${characterId}`,
        { method: 'DELETE' },
        'Failed to delete character',
      )
    },
    onMutate: async (characterId): Promise<DeleteCharacterContext> => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.globalAssets.characters(),
        exact: false,
      })
      const previousQueries = captureCharacterQuerySnapshots(queryClient)

      queryClient.setQueriesData<GlobalCharacter[] | undefined>(
        {
          queryKey: queryKeys.globalAssets.characters(),
          exact: false,
        },
        (previous) => previous?.filter((character) => character.id !== characterId),
      )

      return { previousQueries }
    },
    onError: (_error, _characterId, context) => {
      if (!context) return
      restoreCharacterQuerySnapshots(queryClient, context.previousQueries)
    },
    onSettled: invalidateCharacters,
  })
}
