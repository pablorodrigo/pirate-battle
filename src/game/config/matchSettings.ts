import type { GameplayConfig } from './GameplayConfig.ts'
import { deepFreeze } from './deepFreeze.ts'
import { defaultGameplayConfig } from './defaultConfig.ts'

/** The two parameters players can change in Options. */
export type MatchSettings = {
  readonly matchDurationSeconds: number
  readonly spawnIntervalSeconds: number
}

export type MatchSettingsErrors = Partial<Record<keyof MatchSettings, string>>

export const MATCH_DURATION_LIMITS = { min: 60, max: 180, step: 1 } as const
export const SPAWN_INTERVAL_LIMITS = { min: 1, max: 10, step: 0.5 } as const

export const defaultMatchSettings: MatchSettings = {
  matchDurationSeconds: defaultGameplayConfig.matchDurationSeconds,
  spawnIntervalSeconds: defaultGameplayConfig.spawn.intervalSeconds,
}

export function validateMatchSettings(settings: MatchSettings): MatchSettingsErrors {
  const errors: MatchSettingsErrors = {}
  const duration = settings.matchDurationSeconds
  if (
    !Number.isInteger(duration) ||
    duration < MATCH_DURATION_LIMITS.min ||
    duration > MATCH_DURATION_LIMITS.max
  ) {
    errors.matchDurationSeconds = `Game session time must be a whole number of seconds between ${MATCH_DURATION_LIMITS.min} and ${MATCH_DURATION_LIMITS.max}.`
  }
  const interval = settings.spawnIntervalSeconds
  if (
    !Number.isFinite(interval) ||
    interval < SPAWN_INTERVAL_LIMITS.min ||
    interval > SPAWN_INTERVAL_LIMITS.max ||
    !Number.isInteger(interval / SPAWN_INTERVAL_LIMITS.step)
  ) {
    errors.spawnIntervalSeconds = `Enemy spawn time must be between ${SPAWN_INTERVAL_LIMITS.min} and ${SPAWN_INTERVAL_LIMITS.max} seconds, in steps of ${SPAWN_INTERVAL_LIMITS.step}.`
  }
  return errors
}

export function isValidMatchSettings(settings: MatchSettings): boolean {
  return Object.keys(validateMatchSettings(settings)).length === 0
}

/** Builds the frozen configuration a match runs on. */
export function createMatchConfig(
  settings: MatchSettings,
  base: GameplayConfig = defaultGameplayConfig,
): GameplayConfig {
  if (!isValidMatchSettings(settings)) {
    throw new RangeError('Invalid match settings.')
  }
  return deepFreeze({
    ...base,
    matchDurationSeconds: settings.matchDurationSeconds,
    spawn: { ...base.spawn, intervalSeconds: settings.spawnIntervalSeconds },
  })
}

/**
 * Identifies the rule set of a match. Only matches with the same identifier
 * are ranked together: the rules version covers balance and the arena, and
 * the two settings are the only per-match parameters.
 */
export function rulesetIdOf(config: GameplayConfig): string {
  return `r${config.rulesVersion}-d${config.matchDurationSeconds}-s${config.spawn.intervalSeconds}`
}
