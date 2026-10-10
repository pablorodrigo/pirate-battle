import { describe, expect, it } from 'vitest'
import { RULES_VERSION } from '../game/config/defaultConfig.ts'
import { fixtureMatches } from './fixtures.ts'

const OWNER = { id: 'player-local', name: 'Captain Local' }

describe('fixtureMatches', () => {
  it('gives the local captain three pages of history in the paginated preset only', () => {
    const matches = fixtureMatches('paginated', OWNER)
    const own = matches.filter((match) => match.playerId === OWNER.id)

    expect(own).toHaveLength(23)
    expect(own.every((match) => match.playerName === OWNER.name)).toBe(true)
    expect(new Set(matches.map((match) => match.matchId)).size).toBe(matches.length)
    expect(fixtureMatches('default', OWNER).some((match) => match.playerId === OWNER.id)).toBe(false)
  })

  it('keeps the default ruleset at five pages of ten', () => {
    const defaultRuleset = fixtureMatches('paginated', OWNER).filter((match) => match.rulesetId === `r${RULES_VERSION}-d120-s2.5`)
    expect(defaultRuleset).toHaveLength(46)
  })
})
