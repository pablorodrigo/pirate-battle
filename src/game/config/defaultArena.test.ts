import { describe, expect, it } from 'vitest'
import { resolveCircleRect } from '../core/math/geometry.ts'
import { defaultGameplayConfig } from './defaultConfig.ts'
import { defaultArena } from './defaultArena.ts'

const largestRadius = Math.max(
  defaultGameplayConfig.player.radius,
  defaultGameplayConfig.chaser.radius,
  defaultGameplayConfig.shooter.radius,
)

function fitsInArena(x: number, y: number, radius: number): boolean {
  const insideBounds =
    x >= radius && y >= radius && x <= defaultArena.width - radius && y <= defaultArena.height - radius
  return insideBounds && defaultArena.islands.every((island) => !resolveCircleRect(x, y, radius, island))
}

describe('defaultArena', () => {
  it('starts the player on open water', () => {
    const { x, y } = defaultArena.playerStart
    expect(fitsInArena(x, y, defaultGameplayConfig.player.radius)).toBe(true)
  })

  it('keeps every safe spawn point on open water and far from the player start', () => {
    for (const point of defaultArena.safeSpawnPoints) {
      expect(fitsInArena(point.x, point.y, largestRadius)).toBe(true)
      const distance = Math.hypot(point.x - defaultArena.playerStart.x, point.y - defaultArena.playerStart.y)
      expect(distance).toBeGreaterThanOrEqual(defaultGameplayConfig.spawn.minDistanceFromPlayer)
    }
  })
})
