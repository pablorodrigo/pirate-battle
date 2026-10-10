import { describe, expect, it } from 'vitest'
import type { ArenaDefinition } from '../../config/ArenaDefinition.ts'
import { defaultArena } from '../../config/defaultArena.ts'
import { defaultGameplayConfig } from '../../config/defaultConfig.ts'
import { rectContains, resolveCircleRect } from '../math/geometry.ts'
import { MinHeap } from './MinHeap.ts'
import { NavigationGrid } from './NavigationGrid.ts'

// A wall-like island in the middle forces a detour between left and right,
// through 120-unit passages above and below it.
const arena: ArenaDefinition = {
  width: 800,
  height: 600,
  islands: [{ x: 360, y: 120, width: 80, height: 360 }],
  playerStart: { x: 100, y: 300, angle: 0 },
  safeSpawnPoints: [],
}
const island = arena.islands[0] ?? { x: 0, y: 0, width: 0, height: 0 }

describe('MinHeap', () => {
  it('pops items in priority order', () => {
    const heap = new MinHeap()
    for (const [item, priority] of [[1, 5], [2, 1], [3, 3], [4, 0], [5, 4]] as const) {
      heap.push(item, priority)
    }
    const order = Array.from({ length: 5 }, () => heap.pop())
    expect(order).toEqual([4, 2, 3, 5, 1])
  })
})

describe('NavigationGrid', () => {
  it('detects whether an island blocks the straight line', () => {
    const grid = new NavigationGrid(arena, 40, 24)
    expect(grid.hasLineOfSight(100, 300, 700, 300)).toBe(false)
    expect(grid.hasLineOfSight(100, 40, 700, 40)).toBe(true)
  })

  it('steers straight at the target when it is in sight', () => {
    const grid = new NavigationGrid(arena, 40, 24)
    grid.setTarget(300, 300)
    expect(grid.nextWaypoint(100, 300)).toEqual({ x: 300, y: 300 })
  })

  it('leads around an island to reach a target hidden behind it', () => {
    const grid = new NavigationGrid(arena, 40, 24)
    grid.setTarget(700, 300)
    const speed = 3
    const ship = { x: 100, y: 300 }

    for (let step = 0; step < 1000; step += 1) {
      const waypoint = grid.nextWaypoint(ship.x, ship.y)
      expect(waypoint).not.toBeNull()
      if (!waypoint) {
        return
      }
      expect(rectContains(island, waypoint.x, waypoint.y)).toBe(false)
      const dx = waypoint.x - ship.x
      const dy = waypoint.y - ship.y
      const distance = Math.hypot(dx, dy)
      if (distance <= speed) {
        ship.x = waypoint.x
        ship.y = waypoint.y
      } else {
        ship.x += (dx / distance) * speed
        ship.y += (dy / distance) * speed
      }
      // A ship following the waypoints never overlaps the island.
      expect(resolveCircleRect(ship.x, ship.y, 20, island)).toBeNull()
      if (Math.hypot(700 - ship.x, 300 - ship.y) < 1) {
        break
      }
    }
    expect(Math.hypot(700 - ship.x, 300 - ship.y)).toBeLessThan(1)
  })

  it('reports reachability of open water', () => {
    const grid = new NavigationGrid(arena, 40, 24)
    grid.setTarget(700, 300)
    expect(grid.isReachable(100, 100)).toBe(true)
  })

  it('connects every fallback spawn point of the default arena to the player start', () => {
    const grid = new NavigationGrid(defaultArena, defaultGameplayConfig.navigation.cellSize, 24)
    grid.setTarget(defaultArena.playerStart.x, defaultArena.playerStart.y)
    for (const point of defaultArena.safeSpawnPoints) {
      expect(grid.isReachable(point.x, point.y)).toBe(true)
    }
  })
})
