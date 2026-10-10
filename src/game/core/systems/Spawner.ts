import type { EnemyKind, GameplayConfig } from '../../config/GameplayConfig.ts'
import { createChaserShip, createShooterShip } from '../entities.ts'
import { distanceSquared, resolveCircleRect, type Point } from '../math/geometry.ts'
import type { SeededRandom } from '../math/random.ts'
import type { NavigationGrid } from '../navigation/NavigationGrid.ts'
import type { World } from '../World.ts'
import { secondsToSteps } from './combat.ts'

/** Extra water kept around a new ship, beyond its radius. */
const SPAWN_CLEARANCE = 8

/**
 * Brings in one enemy per configured interval of active play. The opening
 * sequence guarantees both kinds appear; later kinds come from the seeded
 * generator. Positions must be on reachable open water, clear of other
 * ships and far enough from the player to rule out unavoidable damage.
 */
export class Spawner {
  private readonly config: GameplayConfig
  private readonly random: SeededRandom
  private readonly intervalSteps: number
  private spawnedCount = 0

  constructor(config: GameplayConfig, random: SeededRandom) {
    this.config = config
    this.random = random
    this.intervalSteps = Math.max(1, secondsToSteps(config.spawn.intervalSeconds, config))
  }

  /** Spawns the enemy due at the end of this step, if any. */
  update(world: World, grid: NavigationGrid): void {
    if ((world.step + 1) % this.intervalSteps !== 0) {
      return
    }
    const kind = this.nextKind()
    const radius = this.config[kind].radius
    const position = this.findPosition(world, grid, radius)
    if (!position) {
      // Every candidate was unsafe: skip this spawn rather than queue a burst.
      return
    }
    const player = world.player
    const placement = { ...position, angle: Math.atan2(player.y - position.y, player.x - position.x) }
    const id = world.nextId()
    const enemy =
      kind === 'chaser'
        ? createChaserShip(id, this.config.chaser, placement)
        : createShooterShip(
            id,
            this.config.shooter,
            placement,
            world.step + secondsToSteps(this.config.shooter.cannon.cooldownSeconds, this.config),
          )
    world.enemies.push(enemy)
    this.spawnedCount += 1
    world.emit({ type: 'enemySpawned', shipId: id, kind })
  }

  private nextKind(): EnemyKind {
    const { openingSequence, weights } = this.config.spawn
    const opening = openingSequence[this.spawnedCount]
    if (opening) {
      return opening
    }
    const total = weights.chaser + weights.shooter
    return this.random.next() * total < weights.chaser ? 'chaser' : 'shooter'
  }

  private findPosition(world: World, grid: NavigationGrid, radius: number): Point | null {
    const { width, height } = world.arena
    const margin = radius + SPAWN_CLEARANCE
    for (let attempt = 0; attempt < this.config.spawn.attempts; attempt += 1) {
      const candidate = {
        x: this.random.range(margin, width - margin),
        y: this.random.range(margin, height - margin),
      }
      if (this.isSafe(world, grid, candidate, radius)) {
        return candidate
      }
    }
    // Fallback: the arena's safe points, farthest from the player first.
    const player = world.player
    const fallbacks = [...world.arena.safeSpawnPoints].sort(
      (a, b) => distanceSquared(b.x, b.y, player.x, player.y) - distanceSquared(a.x, a.y, player.x, player.y),
    )
    return fallbacks.find((point) => this.isSafe(world, grid, point, radius)) ?? null
  }

  private isSafe(world: World, grid: NavigationGrid, point: Point, radius: number): boolean {
    const player = world.player
    const minDistance = this.config.spawn.minDistanceFromPlayer
    if (distanceSquared(point.x, point.y, player.x, player.y) < minDistance * minDistance) {
      return false
    }
    const onIsland = world.arena.islands.some((island) =>
      resolveCircleRect(point.x, point.y, radius + SPAWN_CLEARANCE, island),
    )
    if (onIsland) {
      return false
    }
    const crowded = world.enemies.some((enemy) => {
      const gap = radius + enemy.radius + SPAWN_CLEARANCE
      return enemy.alive && distanceSquared(point.x, point.y, enemy.x, enemy.y) < gap * gap
    })
    return !crowded && grid.isReachable(point.x, point.y)
  }
}
