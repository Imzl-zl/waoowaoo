'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-fetch'
import type { ProductionPrepDocument, ProductionSourceMode } from '@/lib/production-bible'
import type {
  ProjectProductionPrepDetail,
  ProductionPrepGenerationResult,
  ProductionPrepMutationResult,
} from '@/lib/production-prep/types'
import { queryKeys } from '../keys'
import { requestJsonWithError } from '../mutations/mutation-shared'

type ProductionPrepDetailResponse = {
  productionPrep: ProjectProductionPrepDetail
}

export type ProductionPrepExtractInput = Readonly<{
  sourceText: string
  sourceMode: ProductionSourceMode
  title?: string
  instruction?: string
  language?: string
}>

export type ProductionPrepEpisodePlanningInput = Readonly<{
  episodeCount: number
  targetDurationSeconds: number
  minDurationSeconds: number
  maxDurationSeconds: number
  pacing: 'slow' | 'balanced' | 'fast'
  instruction?: string
  language?: string
}>

function productionPrepPath(projectId: string): string {
  return `/api/projects/${projectId}/production-prep`
}

export function useProjectProductionPrep(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.productionPrep.detail(projectId || ''),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      const response = await apiFetch(productionPrepPath(projectId))
      if (!response.ok) throw new Error('Failed to load production prep')
      const data = await response.json() as ProductionPrepDetailResponse
      return data.productionPrep
    },
    enabled: Boolean(projectId),
    staleTime: 5000,
  })
}

export function useSaveProjectProductionPrep(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (document: ProductionPrepDocument) => {
      const result = await requestJsonWithError<ProductionPrepMutationResult>(
        productionPrepPath(projectId),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document }),
        },
        'Failed to save production prep',
      )
      return result
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.productionPrep.detail(projectId), result.productionPrep)
    },
  })
}

export function useExtractProjectProductionPrep(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProductionPrepExtractInput) => {
      const result = await requestJsonWithError<ProductionPrepGenerationResult>(
        `${productionPrepPath(projectId)}/extract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        'Failed to extract production prep',
      )
      return result
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.productionPrep.detail(projectId), result.productionPrep)
    },
  })
}

export function usePlanProjectProductionPrepEpisodes(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProductionPrepEpisodePlanningInput) => {
      const result = await requestJsonWithError<ProductionPrepGenerationResult>(
        `${productionPrepPath(projectId)}/plan-episodes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        'Failed to plan episodes',
      )
      return result
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.productionPrep.detail(projectId), result.productionPrep)
    },
  })
}
