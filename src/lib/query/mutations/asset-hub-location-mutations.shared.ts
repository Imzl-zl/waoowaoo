import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'
import type { GlobalLocation } from '../hooks/useGlobalAssets'

export interface SelectLocationImageContext {
  previousQueries: Array<{
    queryKey: readonly unknown[]
    data: GlobalLocation[] | undefined
  }>
  targetKey: string
  requestId: number
}

export interface DeleteLocationContext {
  previousQueries: Array<{
    queryKey: readonly unknown[]
    data: GlobalLocation[] | undefined
  }>
}

export function applyLocationSelection(
  locations: GlobalLocation[] | undefined,
  locationId: string,
  imageIndex: number | null,
): GlobalLocation[] | undefined {
  if (!locations) return locations
  return locations.map((location) => {
    if (location.id !== locationId) return location
    return {
      ...location,
      images: (location.images || []).map((image) => ({
        ...image,
        isSelected: imageIndex !== null && image.imageIndex === imageIndex,
      })),
    }
  })
}

export function captureLocationQuerySnapshots(queryClient: QueryClient) {
  return queryClient
    .getQueriesData<GlobalLocation[]>({
      queryKey: queryKeys.globalAssets.locations(),
      exact: false,
    })
    .map(([queryKey, data]) => ({ queryKey, data }))
}

export function restoreLocationQuerySnapshots(
  queryClient: QueryClient,
  snapshots: Array<{ queryKey: readonly unknown[]; data: GlobalLocation[] | undefined }>,
) {
  snapshots.forEach((snapshot) => {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data)
  })
}
