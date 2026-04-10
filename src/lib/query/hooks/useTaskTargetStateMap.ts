'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../keys'
import type { TaskTargetOverlayMap } from '../task-target-overlay'
import {
  buildTaskTargetStateMap,
  fetchTaskTargetStatesBatched,
  getTaskTargetStateRefetchInterval,
  materializeTaskTargetStates,
  mergeTaskTargetStates,
  normalizeTargets,
  taskTargetStateKey,
} from './useTaskTargetStateMap.shared'
import type {
  TaskTargetState,
  TaskTargetStateQuery,
} from './useTaskTargetStateMap.shared'

export type { TaskTargetState, TaskTargetStateQuery } from './useTaskTargetStateMap.shared'

export function useTaskTargetStateMap(
  projectId: string | null | undefined,
  targets: TaskTargetStateQuery[],
  options: {
    enabled?: boolean
    staleTime?: number
  } = {},
) {
  const normalizedTargets = useMemo(() => normalizeTargets(targets), [targets])
  const serializedTargets = useMemo(
    () => JSON.stringify(normalizedTargets),
    [normalizedTargets],
  )
  const enabled = (options.enabled ?? true) && !!projectId && normalizedTargets.length > 0

  const query = useQuery<TaskTargetState[]>({
    queryKey: queryKeys.tasks.targetStates(projectId || '', serializedTargets),
    enabled,
    staleTime: options.staleTime ?? 15000,
    refetchInterval: (state) =>
      getTaskTargetStateRefetchInterval(state.state.data as TaskTargetState[] | undefined),
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => fetchTaskTargetStatesBatched(projectId || '', normalizedTargets),
  })

  const overlayQuery = useQuery<TaskTargetOverlayMap>({
    queryKey: queryKeys.tasks.targetStateOverlay(projectId || ''),
    enabled: false,
    initialData: {},
    queryFn: async () => ({}),
  })

  const mergedByKey = useMemo(() => {
    return mergeTaskTargetStates({
      projectId,
      targets: normalizedTargets,
      serverStates: query.data,
      overlay: overlayQuery.data,
    })
  }, [normalizedTargets, overlayQuery.data, projectId, query.data])

  const mergedData = useMemo(
    () => materializeTaskTargetStates(normalizedTargets, mergedByKey),
    [mergedByKey, normalizedTargets],
  )

  const byKey = useMemo(
    () => buildTaskTargetStateMap(mergedData),
    [mergedData],
  )

  const getState = useMemo(() => {
    return (targetType: string, targetId: string) =>
      byKey.get(taskTargetStateKey(targetType, targetId)) || null
  }, [byKey])

  return {
    ...query,
    data: mergedData,
    byKey,
    getState,
  }
}
