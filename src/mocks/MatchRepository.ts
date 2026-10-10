import {
  compareForHistory,
  compareForRanking,
  isSameMatch,
  type CompletedMatch,
  type Page,
  type RankingEntry,
  type RegisteredMatch,
} from '../shared/contracts/matches.ts'
import { type FixtureCaptain, fixtureMatches, type FixturePreset } from './fixtures.ts'

export type StoredDatabase = {
  /** Grows with every write, so readers can tell older answers from newer ones. */
  readonly revision: number
  readonly matches: readonly RegisteredMatch[]
}

export type MatchStore = {
  load(): StoredDatabase | null
  save(database: StoredDatabase): void
}

export type RegisterOutcome =
  | { readonly kind: 'created' | 'existing'; readonly match: RegisteredMatch; readonly revision: number }
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
  reset(preset: FixturePreset, owner?: FixtureCaptain): void {
    this.store.save({ revision: 1, matches: fixtureMatches(preset, owner) })
  }

  register(match: CompletedMatch, now: Date): RegisterOutcome {
    const { revision, matches } = this.database()
    const existing = matches.find((candidate) => candidate.matchId === match.matchId)
    if (existing) {
      return isSameMatch(existing, match) ? { kind: 'existing', match: existing, revision } : { kind: 'conflict' }
    }
    const registered: RegisteredMatch = { ...match, registeredAt: now.toISOString() }
    this.store.save({ revision: revision + 1, matches: [...matches, registered] })
    return { kind: 'created', match: registered, revision: revision + 1 }
  }

  ranking(rulesetId: string, page: number, pageSize: number): Page<RankingEntry> {
    const { revision, matches } = this.database()
    const ranked = matches
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
    return paginate(ranked, page, pageSize, revision)
  }

  history(playerId: string, page: number, pageSize: number): Page<RegisteredMatch> {
    const { revision, matches } = this.database()
    const mine = matches.filter((match) => match.playerId === playerId).sort(compareForHistory)
    return paginate(mine, page, pageSize, revision)
  }

  private database(): StoredDatabase {
    const stored = this.store.load()
    if (stored) {
      return stored
    }
    const seeded = { revision: 1, matches: fixtureMatches('default') }
    this.store.save(seeded)
    return seeded
  }
}

function paginate<T>(items: readonly T[], page: number, pageSize: number, revision: number): Page<T> {
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / pageSize),
    revision,
  }
}
