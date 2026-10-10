import { describe, expect, it } from 'vitest'
import { defaultArena } from '../../config/defaultArena.ts'
import { defaultGameplayConfig } from '../../config/defaultConfig.ts'
import { resolveCircleRect, type Point, type Rect } from '../math/geometry.ts'
import { enemyClearance, NavigationGrid } from '../navigation/NavigationGrid.ts'
import { SPAWN_CLEARANCE } from '../systems/Spawner.ts'
import { classicMap } from './classicMap.ts'
import { generateMap } from './generateMap.ts'
import { MAP_TILE } from './MapLayout.ts'

const config = defaultGameplayConfig
const rules = config.map
const maps = Array.from({ length: 300 }, (_, index) => generateMap(index + 1, config))
const { width, height, playerStart } = defaultArena

/** Shortest distance between two rectangles, zero when they touch or overlap. */
function distanceBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width))
  const dy = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height))
  return Math.hypot(dx, dy)
}

function distanceToRect(point: Point, rect: Rect): number {
  return distanceBetween({ x: point.x, y: point.y, width: 0, height: 0 }, rect)
}

describe('generateMap', () => {
  it('draws a layout of its own for every seed tried', () => {
    expect(maps.every((map) => map.kind === 'generated')).toBe(true)
    const layouts = new Set(maps.map((map) => JSON.stringify(map.arena.islands)))
    expect(layouts.size).toBe(maps.length)
  })

  it('draws the same map from the same seed', () => {
    expect(generateMap(42, config)).toEqual(generateMap(42, config))
  })

  it('keeps the counts and sizes of the configuration and the art', () => {
    for (const map of maps) {
      const islands = map.obstacles.filter((obstacle) => obstacle.kind !== 'reef')
      const reefs = map.obstacles.filter((obstacle) => obstacle.kind === 'reef')
      expect(islands.length).toBeGreaterThanOrEqual(rules.islandCount.min)
      expect(islands.length).toBeLessThanOrEqual(rules.islandCount.max)
      expect(reefs.length).toBeLessThanOrEqual(rules.reefCount.max)
      expect(map.arena.islands).toEqual(map.obstacles.map((obstacle) => obstacle.collider))
      for (const { kind, area, collider } of map.obstacles) {
        expect(area.x % MAP_TILE).toBe(0)
        expect(area.y % MAP_TILE).toBe(0)
        if (kind === 'grass') {
          expect(area).toMatchObject({ width: 4 * MAP_TILE, height: 4 * MAP_TILE })
        }
        if (kind === 'reef') {
          expect(distanceBetween(area, collider)).toBe(0)
          expect(collider.width * collider.height).toBeLessThan(area.width * area.height)
        } else {
          expect(collider).toEqual(area)
        }
      }
    }
  })

  it('keeps every obstacle inside the arena, against a border only as a sand coast', () => {
    for (const map of maps) {
      for (const { kind, area, coast } of map.obstacles) {
        expect(area.x).toBeGreaterThanOrEqual(0)
        expect(area.y).toBeGreaterThanOrEqual(0)
        expect(area.x + area.width).toBeLessThanOrEqual(width)
        expect(area.y + area.height).toBeLessThanOrEqual(height)
        expect(coast).toEqual({
          top: area.y === 0,
          right: area.x + area.width === width,
          bottom: area.y + area.height === height,
          left: area.x === 0,
        })
        const gaps = [
          coast.left ? Infinity : area.x,
          coast.top ? Infinity : area.y,
          coast.right ? Infinity : width - (area.x + area.width),
          coast.bottom ? Infinity : height - (area.y + area.height),
        ]
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(rules.minChannel)
        if (kind !== 'sand') {
          expect(Object.values(coast)).not.toContain(true)
        }
      }
    }
  })

  it('leaves a channel any ship can sail through between obstacles', () => {
    for (const map of maps) {
      const colliders = map.arena.islands
      colliders.forEach((island, index) => {
        for (const other of colliders.slice(index + 1)) {
          expect(distanceBetween(island, other)).toBeGreaterThanOrEqual(rules.minChannel)
        }
      })
    }
  })

  it('keeps the water around the player start open', () => {
    for (const map of maps) {
      expect(map.arena.playerStart).toEqual(playerStart)
      for (const island of map.arena.islands) {
        expect(distanceToRect(playerStart, island)).toBeGreaterThanOrEqual(rules.startClearance)
      }
    }
  })

  it('covers a bounded share of the arena', () => {
    for (const map of maps) {
      const covered = map.arena.islands.reduce((sum, island) => sum + island.width * island.height, 0)
      expect(covered / (width * height)).toBeGreaterThanOrEqual(rules.coverage.min)
      expect(covered / (width * height)).toBeLessThanOrEqual(rules.coverage.max)
    }
  })

  it('lets enemies reach all of the water', () => {
    for (const map of maps) {
      const grid = new NavigationGrid(map.arena, config.navigation.cellSize, enemyClearance(config))
      grid.setTarget(playerStart.x, playerStart.y)
      expect(grid.countUnreachableCells()).toBe(0)
    }
  })

  it('offers fallback spawn points on open water, far from the start and reachable', () => {
    const radius = Math.max(config.chaser.radius, config.shooter.radius) + SPAWN_CLEARANCE
    for (const map of maps) {
      const grid = new NavigationGrid(map.arena, config.navigation.cellSize, enemyClearance(config))
      grid.setTarget(playerStart.x, playerStart.y)
      expect(map.arena.safeSpawnPoints.length).toBeGreaterThanOrEqual(4)
      for (const point of map.arena.safeSpawnPoints) {
        expect(Math.hypot(point.x - playerStart.x, point.y - playerStart.y)).toBeGreaterThanOrEqual(
          config.spawn.minDistanceFromPlayer,
        )
        expect(map.arena.islands.every((island) => !resolveCircleRect(point.x, point.y, radius, island))).toBe(true)
        expect(grid.isReachable(point.x, point.y)).toBe(true)
      }
    }
  })

  it('falls back to the classic map when no layout can meet the rules', () => {
    const impossible = { ...config, map: { ...rules, coverage: { min: 0.9, max: 0.95 } } }
    expect(generateMap(7, impossible)).toBe(classicMap)
  })
})
