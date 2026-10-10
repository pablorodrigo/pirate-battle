import { describe, expect, it } from 'vitest'
import { defaultGameplayConfig, RULES_VERSION } from './defaultConfig.ts'
import {
  createMatchConfig,
  defaultMatchSettings,
  rulesetIdOf,
  validateMatchSettings,
} from './matchSettings.ts'

describe('validateMatchSettings', () => {
  it('accepts the defaults and the limits', () => {
    expect(validateMatchSettings(defaultMatchSettings)).toEqual({})
    expect(validateMatchSettings({ matchDurationSeconds: 60, spawnIntervalSeconds: 1 })).toEqual({})
    expect(validateMatchSettings({ matchDurationSeconds: 180, spawnIntervalSeconds: 10 })).toEqual({})
  })

  it('rejects durations outside 60–180 or with fractions', () => {
    for (const matchDurationSeconds of [59, 181, 90.5, Number.NaN]) {
      const errors = validateMatchSettings({ matchDurationSeconds, spawnIntervalSeconds: 2.5 })
      expect(errors.matchDurationSeconds).toMatch(/between 60 and 180/)
    }
  })

  it('rejects spawn intervals outside 1–10 or off the 0.5 s step', () => {
    for (const spawnIntervalSeconds of [0, 0.5, 10.5, 2.3, Number.POSITIVE_INFINITY]) {
      const errors = validateMatchSettings({ matchDurationSeconds: 120, spawnIntervalSeconds })
      expect(errors.spawnIntervalSeconds).toMatch(/between 1 and 10 seconds/)
    }
  })
})

describe('createMatchConfig', () => {
  it('applies the settings to a frozen copy of the base configuration', () => {
    const config = createMatchConfig({ matchDurationSeconds: 90, spawnIntervalSeconds: 4 })

    expect(config.matchDurationSeconds).toBe(90)
    expect(config.spawn.intervalSeconds).toBe(4)
    expect(config.player).toEqual(defaultGameplayConfig.player)
    expect(Object.isFrozen(config.spawn)).toBe(true)
    expect(defaultGameplayConfig.matchDurationSeconds).toBe(120)
  })

  it('refuses invalid settings', () => {
    expect(() => createMatchConfig({ matchDurationSeconds: 10, spawnIntervalSeconds: 4 })).toThrow(
      RangeError,
    )
  })
})

describe('rulesetIdOf', () => {
  it('combines the rules version with the per-match settings', () => {
    const config = createMatchConfig({ matchDurationSeconds: 150, spawnIntervalSeconds: 1.5 })
    expect(rulesetIdOf(config)).toBe(`r${RULES_VERSION}-d150-s1.5`)
  })
})

/** FNV-1a over the JSON form: stable for the literal key order of the config. */
function fingerprint(value: unknown): string {
  let hash = 0x811c9dc5
  for (const char of JSON.stringify(value)) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0
  }
  return hash.toString(16)
}

describe('rules versioning', () => {
  // When this test fails, the balance changed: bump RULES_VERSION and record
  // the new fingerprint, so matches played under different rules never share
  // a ranking.
  const fingerprintsByVersion: Record<number, string> = {
    1: '75080705',
  }

  it('requires a new rules version for every balance change', () => {
    expect(fingerprint(defaultGameplayConfig)).toBe(fingerprintsByVersion[RULES_VERSION])
  })
})
