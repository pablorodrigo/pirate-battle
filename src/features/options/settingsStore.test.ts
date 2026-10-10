import { describe, expect, it } from 'vitest'
import { parseSettings } from './settingsStore.ts'

describe('parseSettings', () => {
  it('accepts valid stored settings', () => {
    expect(parseSettings({ matchDurationSeconds: 90, spawnIntervalSeconds: 4.5 })).toEqual({
      matchDurationSeconds: 90,
      spawnIntervalSeconds: 4.5,
    })
  })

  it('rejects corrupt or out-of-range data', () => {
    expect(parseSettings(null)).toBeNull()
    expect(parseSettings('120')).toBeNull()
    expect(parseSettings({ matchDurationSeconds: '90', spawnIntervalSeconds: 4 })).toBeNull()
    expect(parseSettings({ matchDurationSeconds: 500, spawnIntervalSeconds: 4 })).toBeNull()
    expect(parseSettings({ matchDurationSeconds: 90, spawnIntervalSeconds: 0.2 })).toBeNull()
  })
})
