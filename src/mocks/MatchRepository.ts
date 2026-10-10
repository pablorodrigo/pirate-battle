import {
  compareForHistory,
  compareForRanking,
  isSameMatch,
  type CompletedMatch,
  type Page,
  type RankingEntry,
  type RegisteredMatch,
} from '../shared/contracts/matches.ts'
import { fixtureMatches, type FixturePreset } from './fixtures.ts'

export type MatchStore = {
  load(): RegisteredMatch[] | null
  save(matches: readonly RegisteredMatch[]): void
}

export type RegisterOutcome =
  | { readonly kind: 'created' | 'existing'; readonly match: RegisteredMatch }
  | { readonly kind: 'conflict' }

/**
 * The mock server's database: confirmed matches, from which both the
 * ranking and every player's history are derived. Writes are synchronous
 * read-modify-write cycles, so they cannot interleave within a page; the
 * ranking has no table of its own, so a match can never be ranked twice.
 */
export class MatchRepository {
  private readonly store: MatchStore

  constructor(store: MatchStore) {
    this.store = store
  }

  /** Restores the fixtures of a preset, dropping every registered match. */
  reset(preset: FixturePreset): void {
    this.store.save(fixtureMatches(preset))
  }

  register(match: CompletedMatch, now: Date): RegisterOutcome {
    const matches = this.all()
    const existing = matches.find((candidate) => candidate.matchId === match.matchId)
    if (existing) {
      return isSameMatch(existing, match) ? { kind: 'existing', match: existing } : { kind: 'conflict' }
    }
    const registered: RegisteredMatch = { ...match, registeredAt: now.toISOString() }
    this.store.save([...matches, registered])
    return { kind: 'created', match: registered }
  }

  ranking(rulesetId: string, page: number, pageSize: number): Page<RankingEntry> {
    const ranked = this.all()
      .filter((match) => match.rulesetId === rulesetId)
      .sort(compareForRanking)
      .map((match, index) => ({
        rank: index + 1,
        matchId: match.matchId,
        playerId: match.playerId,
        playerName: match.playerName,
        score: match.score,
        durationMs: match.durationMs,
        completedAt: match.completedAt,
      }))
    return paginate(ranked, page, pageSize)
  }

  history(playerId: string, page: number, pageSize: number): Page<RegisteredMatch> {
    const matches = this.all()
      .filter((match) => match.playerId === playerId)
      .sort(compareForHistory)
    return paginate(matches, page, pageSize)
  }

  private all(): RegisteredMatch[] {
    const stored = this.store.load()
    if (stored) {
      return stored
    }
    const seeded = fixtureMatches('default')
    this.store.save(seeded)
    return seeded
  }
}

function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.ceil(items.length / pageSize)
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
  }
}
