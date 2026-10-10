import {
  parsePage,
  parseRankingEntry,
  parseRegisteredMatch,
  parseRegisterMatchResponse,
  type CompletedMatch,
  type Page,
  type RankingEntry,
  type RegisteredMatch,
  type RegisterMatchResponse,
} from '../contracts/matches.ts'
import { httpClient } from './httpClient.ts'

export type RankingQuery = {
  readonly rulesetId: string
  readonly page: number
  readonly pageSize: number
}

export type HistoryQuery = {
  readonly playerId: string
  readonly page: number
  readonly pageSize: number
}

export async function fetchRanking(query: RankingQuery, signal: AbortSignal): Promise<Page<RankingEntry>> {
  const response = await httpClient.get<unknown>('/ranking', { params: query, signal })
  return parsePage(response.data, parseRankingEntry)
}

export async function fetchHistory(query: HistoryQuery, signal: AbortSignal): Promise<Page<RegisteredMatch>> {
  const { playerId, page, pageSize } = query
  const response = await httpClient.get<unknown>(`/players/${encodeURIComponent(playerId)}/matches`, {
    params: { page, pageSize },
    signal,
  })
  return parsePage(response.data, parseRegisteredMatch)
}

/** Registering is idempotent: the match id is the idempotency key, so a resend returns the existing record. */
export async function registerMatch(match: CompletedMatch): Promise<RegisterMatchResponse> {
  const response = await httpClient.post<unknown>('/matches', match, {
    headers: { 'Idempotency-Key': match.matchId },
  })
  return parseRegisterMatchResponse(response.data)
}
