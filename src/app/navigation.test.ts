import { describe, expect, it } from 'vitest'
import { defaultMatchSettings } from '../game/config/matchSettings.ts'
import type { CompletedMatch } from '../shared/contracts/matches.ts'
import { initialNavigation, navigationReducer, restoredNavigation } from './navigation.ts'

function completed(matchId: string): CompletedMatch {
  return {
    matchId,
    playerId: 'player',
    playerName: 'Captain Test',
    completedAt: '2026-10-10T10:00:00.000Z',
    score: 3,
    durationMs: 42_000,
    endReason: 'death',
    rulesetId: 'r1-d120-s2.5',
    config: { rulesVersion: 1, matchDurationSeconds: 120, spawnIntervalSeconds: 2.5 },
  }
}

const play = (matchId: string) => ({ type: 'play', matchId, settings: defaultMatchSettings }) as const

describe('navigationReducer', () => {
  it('starts a fresh attempt every time a match starts', () => {
    const first = navigationReducer(initialNavigation, play('a'))
    const finished = navigationReducer(first, { type: 'finish', match: completed('a') })
    const second = navigationReducer(finished, play('b'))

    expect(first.screen).toMatchObject({ name: 'game', attempt: 1, matchId: 'a' })
    expect(finished.screen).toMatchObject({ name: 'result', match: { matchId: 'a' } })
    expect(second.screen).toMatchObject({ name: 'game', attempt: 2, matchId: 'b' })
  })

  it('ignores a result that arrives after leaving the match', () => {
    const playing = navigationReducer(initialNavigation, play('a'))
    const menu = navigationReducer(playing, { type: 'showMenu' })
    expect(navigationReducer(menu, { type: 'finish', match: completed('a') })).toBe(menu)
  })

  it('ignores the result of another match', () => {
    const playing = navigationReducer(initialNavigation, play('b'))
    expect(navigationReducer(playing, { type: 'finish', match: completed('a') })).toBe(playing)
  })

  it('reopens the last result only when the player was looking at it', () => {
    expect(restoredNavigation(completed('a'), true).screen).toMatchObject({ name: 'result' })
    expect(restoredNavigation(completed('a'), false)).toBe(initialNavigation)
    expect(restoredNavigation(null, true)).toBe(initialNavigation)
  })
})
