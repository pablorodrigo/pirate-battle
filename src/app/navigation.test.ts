import { describe, expect, it } from 'vitest'
import { defaultMatchSettings } from '../game/config/matchSettings.ts'
import type { MatchResult } from '../game/core/GameSession.ts'
import { initialNavigation, navigationReducer } from './navigation.ts'

const result: MatchResult = { score: 3, activeDurationMs: 42_000, endReason: 'death' }

describe('navigationReducer', () => {
  it('starts a fresh attempt every time a match starts', () => {
    const first = navigationReducer(initialNavigation, { type: 'play', settings: defaultMatchSettings })
    const finished = navigationReducer(first, { type: 'finish', result })
    const second = navigationReducer(finished, { type: 'play', settings: defaultMatchSettings })

    expect(first.screen).toMatchObject({ name: 'game', attempt: 1 })
    expect(finished.screen).toMatchObject({ name: 'result', result })
    expect(second.screen).toMatchObject({ name: 'game', attempt: 2 })
  })

  it('ignores a result that arrives after leaving the match', () => {
    const playing = navigationReducer(initialNavigation, { type: 'play', settings: defaultMatchSettings })
    const menu = navigationReducer(playing, { type: 'showMenu' })
    expect(navigationReducer(menu, { type: 'finish', result })).toBe(menu)
  })
})
