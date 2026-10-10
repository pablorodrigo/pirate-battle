import type { CompletedMatch, MatchConfigSnapshot, RegisteredMatch } from '../shared/contracts/matches.ts'

/** Fixture rulesets: the default Options, and a faster, shorter variant to prove grouping by ruleset. */
const DEFAULT_CONFIG: MatchConfigSnapshot = { rulesVersion: 1, matchDurationSeconds: 120, spawnIntervalSeconds: 2.5 }
const QUICK_CONFIG: MatchConfigSnapshot = { rulesVersion: 1, matchDurationSeconds: 60, spawnIntervalSeconds: 1 }

const CAPTAINS = [
  ['player-anne', 'Anne Bonny'],
  ['player-mary', 'Mary Read'],
  ['player-calico', 'Calico Jack'],
  ['player-edward', 'Edward Teach'],
  ['player-grace', "Grace O'Malley"],
  ['player-henry', 'Henry Morgan'],
  ['player-ching', 'Ching Shih'],
  ['player-william', 'William Kidd'],
] as const

function rulesetIdOf(config: MatchConfigSnapshot): string {
  return `r${config.rulesVersion}-d${config.matchDurationSeconds}-s${config.spawnIntervalSeconds}`
}

/** The local captain, whom the paginated preset gives a history of several pages. */
export type FixtureCaptain = { readonly id: string; readonly name: string }

/** Deterministic fixture match: the same index always produces the same record. */
function fixtureMatch(index: number, config: MatchConfigSnapshot, owner?: FixtureCaptain): RegisteredMatch {
  const [playerId, playerName] = owner ? [owner.id, owner.name] : (CAPTAINS[index % CAPTAINS.length] ?? CAPTAINS[0])
  const fullDurationMs = config.matchDurationSeconds * 1000
  const survived = index % 3 !== 0
  const completedAt = new Date(Date.UTC(2026, 8, 1 + (index % 28), 9 + (index % 11), (index * 7) % 60)).toISOString()
  const match: CompletedMatch = {
    matchId: `fixture-${rulesetIdOf(config)}-${owner ? 'own-' : ''}${String(index).padStart(3, '0')}`,
    playerId,
    playerName,
    completedAt,
    score: (index * 7 + 3) % 23,
    durationMs: survived ? fullDurationMs : Math.round(fullDurationMs * (0.35 + (index % 5) * 0.1)),
    endReason: survived ? 'timeout' : 'death',
    rulesetId: rulesetIdOf(config),
    config,
  }
  return { ...match, registeredAt: completedAt }
}

function range(count: number, config: MatchConfigSnapshot, owner?: FixtureCaptain): RegisteredMatch[] {
  return Array.from({ length: count }, (_, index) => fixtureMatch(index, config, owner))
}

export type FixturePreset = 'default' | 'empty' | 'paginated'

/**
 * Matches that seed the mock database: other players', plus, in the paginated
 * preset, enough of the local captain's for several pages of history. Those
 * use the quick ruleset, so the default ranking keeps its five pages.
 */
export function fixtureMatches(preset: FixturePreset, owner?: FixtureCaptain): RegisteredMatch[] {
  switch (preset) {
    case 'empty':
      return []
    case 'paginated':
      return [...range(46, DEFAULT_CONFIG), ...range(12, QUICK_CONFIG), ...(owner ? range(23, QUICK_CONFIG, owner) : [])]
    case 'default':
      return [...range(8, DEFAULT_CONFIG), ...range(4, QUICK_CONFIG)]
  }
}
