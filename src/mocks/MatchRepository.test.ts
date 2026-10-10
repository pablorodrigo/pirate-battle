import { describe, expect, it } from 'vitest'
import type { CompletedMatch } from '../shared/contracts/matches.ts'
import { MatchRepository, type MatchStore, type StoredDatabase } from './MatchRepository.ts'

function memoryStore(): MatchStore {
  let saved: StoredDatabase | null = null
  return {
    load: () => saved,
    save: (database) => {
      saved = database
    },
  }
}

const NOW = new Date('2026-10-10T12:00:00.000Z')

function match(overrides: Partial<CompletedMatch> = {}): CompletedMatch {
  return {
    matchId: 'match-1',
    playerId: 'player-local',
    playerName: 'Captain Test',
    completedAt: '2026-10-10T11:00:00.000Z',
    score: 5,
    durationMs: 120_000,
    endReason: 'timeout',
    rulesetId: 'r1-d120-s2.5',
    config: { rulesVersion: 1, matchDurationSeconds: 120, spawnIntervalSeconds: 2.5 },
    ...overrides,
  }
}

describe('MatchRepository', () => {
  it('registers a match once and returns the existing record on identical resends', () => {
    const repository = new MatchRepository(memoryStore())
    repository.reset('empty')

    const first = repository.register(match(), NOW)
    const resend = repository.register(match(), new Date('2026-10-10T12:05:00.000Z'))

    expect(first.kind).toBe('created')
    expect(resend).toEqual({
      kind: 'existing',
      match: first.kind === 'created' ? first.match : null,
      revision: first.kind === 'created' ? first.revision : null,
    })
    expect(repository.history('player-local', 1, 10).totalItems).toBe(1)
    expect(repository.ranking('r1-d120-s2.5', 1, 10).totalItems).toBe(1)
  })

  it('rejects a different payload under an existing match id', () => {
    const repository = new MatchRepository(memoryStore())
    repository.reset('empty')
    repository.register(match(), NOW)

    expect(repository.register(match({ score: 99 }), NOW)).toEqual({ kind: 'conflict' })
  })

  it('ranks only the same ruleset, with a deterministic tie-break', () => {
    const repository = new MatchRepository(memoryStore())
    repository.reset('empty')
    repository.register(match({ matchId: 'b', score: 7, durationMs: 90_000 }), NOW)
    repository.register(match({ matchId: 'a', score: 7, durationMs: 90_000 }), NOW)
    repository.register(match({ matchId: 'c', score: 7, durationMs: 120_000 }), NOW)
    repository.register(match({ matchId: 'd', score: 9 }), NOW)
    repository.register(match({ matchId: 'e', score: 50, rulesetId: 'r1-d60-s1' }), NOW)

    const ranking = repository.ranking('r1-d120-s2.5', 1, 10)
    expect(ranking.items.map((entry) => [entry.rank, entry.matchId])).toEqual([
      [1, 'd'],
      [2, 'c'],
      [3, 'a'],
      [4, 'b'],
    ])
  })

  it('pages the history of one player, newest first', () => {
    const repository = new MatchRepository(memoryStore())
    repository.reset('empty')
    for (let day = 1; day <= 12; day += 1) {
      repository.register(
        match({ matchId: `m${day}`, completedAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z` }),
        NOW,
      )
    }
    repository.register(match({ matchId: 'other', playerId: 'someone-else' }), NOW)

    const second = repository.history('player-local', 2, 5)
    expect(second).toMatchObject({ page: 2, pageSize: 5, totalItems: 12, totalPages: 3 })
    expect(second.items.map((item) => item.matchId)).toEqual(['m7', 'm6', 'm5', 'm4', 'm3'])
  })

  it('raises the revision on every new registration only', () => {
    const repository = new MatchRepository(memoryStore())
    repository.reset('empty')
    const before = repository.ranking('r1-d120-s2.5', 1, 10).revision

    repository.register(match(), NOW)
    repository.register(match(), NOW)

    expect(repository.ranking('r1-d120-s2.5', 1, 10).revision).toBe(before + 1)
    expect(repository.history('player-local', 1, 10).revision).toBe(before + 1)
  })

  it('seeds fixtures of other players on first use', () => {
    const repository = new MatchRepository(memoryStore())
    expect(repository.ranking('r1-d120-s2.5', 1, 10).totalItems).toBeGreaterThan(0)
    expect(repository.history('player-local', 1, 10).totalItems).toBe(0)
  })
})
