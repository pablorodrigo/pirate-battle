import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchHistory, fetchRanking } from '../../shared/api/matchesApi.ts'

export const PAGE_SIZE = 10

/** Every parameter that changes a response is part of its key, so caches never mix. */
export const matchQueryKeys = {
  ranking: ['ranking'] as const,
  rankingPage: (rulesetId: string, page: number) => ['ranking', rulesetId, page, PAGE_SIZE] as const,
  history: ['history'] as const,
  historyPage: (playerId: string, page: number) => ['history', playerId, page, PAGE_SIZE] as const,
}

/**
 * The previous page stays on screen while the next one loads, and the list
 * refreshes every time its tab is shown again, even when cached.
 */
export function useRankingPage(rulesetId: string, page: number) {
  return useQuery({
    queryKey: matchQueryKeys.rankingPage(rulesetId, page),
    queryFn: ({ signal }) => fetchRanking({ rulesetId, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  })
}

export function useHistoryPage(playerId: string, page: number) {
  return useQuery({
    queryKey: matchQueryKeys.historyPage(playerId, page),
    queryFn: ({ signal }) => fetchHistory({ playerId, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  })
}
