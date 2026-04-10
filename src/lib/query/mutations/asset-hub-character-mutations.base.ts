import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  requestJsonWithError,
  requestVoidWithError,
} from './mutation-shared'
import { createInvalidateGlobalCharactersCallback } from './asset-hub-character-mutations.shared'

export function useUndoCharacterImage() {
  const queryClient = useQueryClient()
  const invalidateCharacters = createInvalidateGlobalCharactersCallback(queryClient)

  return useMutation({
    mutationFn: async ({ characterId, appearanceIndex }: { characterId: string; appearanceIndex: number }) => {
      return await requestJsonWithError(`/api/assets/${characterId}/revert-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'global',
          kind: 'character',
          appearanceIndex,
        }),
      }, 'Failed to undo image')
    },
    onSuccess: invalidateCharacters,
  })
}

export function useUploadCharacterImage() {
  const queryClient = useQueryClient()
  const invalidateCharacters = createInvalidateGlobalCharactersCallback(queryClient)

  return useMutation({
    mutationFn: async ({
      file,
      characterId,
      appearanceIndex,
      labelText,
      imageIndex,
    }: {
      file: File
      characterId: string
      appearanceIndex: number
      labelText: string
      imageIndex?: number
    }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'character')
      formData.append('id', characterId)
      formData.append('appearanceIndex', appearanceIndex.toString())
      formData.append('labelText', labelText)
      if (imageIndex !== undefined) {
        formData.append('imageIndex', imageIndex.toString())
      }

      return await requestJsonWithError('/api/asset-hub/upload-image', {
        method: 'POST',
        body: formData,
      }, 'Failed to upload image')
    },
    onSuccess: invalidateCharacters,
  })
}

export function useDeleteCharacterAppearance() {
  const queryClient = useQueryClient()
  const invalidateCharacters = createInvalidateGlobalCharactersCallback(queryClient)

  return useMutation({
    mutationFn: async ({ characterId, appearanceIndex }: { characterId: string; appearanceIndex: number }) => {
      await requestVoidWithError(
        `/api/asset-hub/appearances?characterId=${characterId}&appearanceIndex=${appearanceIndex}`,
        { method: 'DELETE' },
        'Failed to delete appearance',
      )
    },
    onSuccess: invalidateCharacters,
  })
}

export function useUploadCharacterVoice() {
  const queryClient = useQueryClient()
  const invalidateCharacters = createInvalidateGlobalCharactersCallback(queryClient)

  return useMutation({
    mutationFn: async ({ file, characterId }: { file: File; characterId: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('characterId', characterId)

      return await requestJsonWithError('/api/asset-hub/character-voice', {
        method: 'POST',
        body: formData,
      }, 'Failed to upload voice')
    },
    onSuccess: invalidateCharacters,
  })
}
