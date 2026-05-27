'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  WorkflowCanvasDefinition,
  WorkflowCanvasValidationResult,
} from '@/lib/workflow-engine/canvas-types'
import { apiFetch } from '@/lib/api-fetch'
import { queryKeys } from '../keys'
import { invalidateQueryTemplates, requestJsonWithError } from '../mutations/mutation-shared'

export type ProjectWorkflowDefinitionSummary = {
  id: string
  projectId: string
  userId: string
  workflowType: string
  title: string
  draftValidation: WorkflowCanvasValidationResult
  publishedVersion: number | null
  publishedVersionId: string | null
  createdAt: string
  updatedAt: string
}

export type ProjectWorkflowDefinitionDetail = ProjectWorkflowDefinitionSummary & {
  draftDefinition: WorkflowCanvasDefinition
}

export type ProjectWorkflowDefinitionVersion = {
  id: string
  workflowDefinitionId: string
  projectId: string
  userId: string
  workflowType: string
  title: string
  version: number
  definition: WorkflowCanvasDefinition
  validation: WorkflowCanvasValidationResult
  createdAt: string
}

type WorkflowDefinitionListResponse = {
  workflowDefinitions: ProjectWorkflowDefinitionSummary[]
}

type WorkflowDefinitionDetailResponse = {
  workflowDefinition: ProjectWorkflowDefinitionDetail
}

type WorkflowDefinitionPublishResponse = {
  definition: ProjectWorkflowDefinitionDetail
  version: ProjectWorkflowDefinitionVersion
}

export type ProjectWorkflowExecutionResponse = {
  runId: string
  run: {
    id: string
    status: string
    workflowType: string
    targetType: string
    targetId: string
  }
}

export type ProjectWorkflowExecutionInput = Readonly<Record<string, unknown>>

export type ExecuteProjectWorkflowDefinitionInput = Readonly<{
  workflowType: string
  executionInput?: ProjectWorkflowExecutionInput
}>

function workflowDetailPath(projectId: string, workflowType: string): string {
  return `/api/projects/${projectId}/workflows/${encodeURIComponent(workflowType)}`
}

export function useProjectWorkflowDefinitions(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.workflowDefinitions.all(projectId || ''),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      const response = await apiFetch(`/api/projects/${projectId}/workflows`)
      if (!response.ok) throw new Error('Failed to load workflow definitions')
      const data = await response.json() as WorkflowDefinitionListResponse
      return data.workflowDefinitions
    },
    enabled: Boolean(projectId),
    staleTime: 5000,
  })
}

export function useProjectWorkflowDefinition(
  projectId: string | null,
  workflowType: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.workflowDefinitions.detail(projectId || '', workflowType || ''),
    queryFn: async () => {
      if (!projectId || !workflowType) throw new Error('Workflow definition key is required')
      const response = await apiFetch(workflowDetailPath(projectId, workflowType))
      if (!response.ok) throw new Error('Failed to load workflow definition')
      const data = await response.json() as WorkflowDefinitionDetailResponse
      return data.workflowDefinition
    },
    enabled: Boolean(projectId && workflowType && enabled),
    staleTime: 5000,
  })
}

export function useSaveProjectWorkflowDefinitionDraft(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (definition: WorkflowCanvasDefinition) => {
      const data = await requestJsonWithError<WorkflowDefinitionDetailResponse>(
        `/api/projects/${projectId}/workflows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition }),
        },
        'Failed to save workflow draft',
      )
      return data.workflowDefinition
    },
    onSuccess: async (definition) => {
      queryClient.setQueryData(
        queryKeys.workflowDefinitions.detail(projectId, definition.workflowType),
        definition,
      )
      await invalidateQueryTemplates(queryClient, [queryKeys.workflowDefinitions.all(projectId)])
    },
  })
}

export function usePublishProjectWorkflowDefinition(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workflowType: string) => {
      const data = await requestJsonWithError<WorkflowDefinitionPublishResponse>(
        `${workflowDetailPath(projectId, workflowType)}/publish`,
        { method: 'POST' },
        'Failed to publish workflow definition',
      )
      return data
    },
    onSuccess: async ({ definition }) => {
      queryClient.setQueryData(
        queryKeys.workflowDefinitions.detail(projectId, definition.workflowType),
        definition,
      )
      await invalidateQueryTemplates(queryClient, [queryKeys.workflowDefinitions.all(projectId)])
    },
  })
}

export function useExecuteProjectWorkflowDefinition(projectId: string) {
  return useMutation({
    mutationFn: async (input: ExecuteProjectWorkflowDefinitionInput) => {
      return await requestJsonWithError<ProjectWorkflowExecutionResponse>(
        `${workflowDetailPath(projectId, input.workflowType)}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input.executionInput || {}),
        },
        'Failed to execute workflow definition',
      )
    },
  })
}
