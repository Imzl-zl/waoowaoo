'use client'

import { useRunStreamState, type RunResult } from './useRunStreamState'

export type PublishedWorkflowRunParams = {
  workflowType: string
  executionInput?: Record<string, unknown>
}

export type PublishedWorkflowRunResult = RunResult

export function usePublishedWorkflowRunStream(projectId: string) {
  return useRunStreamState<PublishedWorkflowRunParams>({
    projectId,
    endpoint: (pid, params) =>
      `/api/projects/${pid}/workflows/${encodeURIComponent(params.workflowType)}/execute`,
    storageKeyPrefix: 'workflow-builder:published-run',
    validateParams: (params) => {
      if (!params.workflowType.trim()) {
        throw new Error('workflowType is required')
      }
    },
    buildRequestBody: (params) => params.executionInput || {},
  })
}
