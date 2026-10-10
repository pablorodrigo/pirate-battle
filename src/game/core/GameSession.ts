import type { ArenaDefinition } from '../config/ArenaDefinition.ts'
import type { GameplayConfig } from '../config/GameplayConfig.ts'
import type { EndReason, GameEvent } from './events.ts'
import type { InputSnapshot } from './input.ts'
import { SeededRandom } from './math/random.ts'
import { NavigationGrid } from './navigation/NavigationGrid.ts'
import { firePlayerCannons, secondsToSteps, updateProjectiles } from './systems/combat.ts'
import {
  fireShooterCannons,
  resolveChaserContacts,
  separateEnemies,
  updateEnemyIntents,
} from './systems/enemies.ts'
import { keepOnOpenWater, moveShip } from './systems/movement.ts'
import { Spawner } from './systems/Spawner.ts'
import { World } from './World.ts'

export type PauseReason = 'manual' | 'blur' | 'hidden'

export type SessionStatus =
  | { readonly kind: 'ready' }
  | { readonly kind: 'running' }
  | { readonly kind: 'paused'; readonly reason: PauseReason }
  | { readonly kind: 'finished'; readonly reason: EndReason }
  | { readonly kind: 'abandoned' }

export type MatchResult = {
  readonly score: number
  readonly activeDurationMs: number
  readonly endReason: EndReason
}

/** Clearance used to plan routes: the largest enemy radius plus a small margin. */
const NAVIGATION_MARGIN = 2

/**
 * One match: the rules state machine around a World. It only advances while
 * running, one fixed step at a time, so the outcome never depends on the
 * frame rate. Everything random comes from the match seed.
 */
export class GameSession {
  readonly config: GameplayConfig
  readonly seed: number
  readonly world: World
  readonly stepSeconds: number
  readonly durationSteps: number
  private readonly navigation: NavigationGrid
  private readonly spawner: Spawner
  private readonly repathSteps: number
  private currentStatus: SessionStatus = { kind: 'ready' }

  constructor(config: GameplayConfig, arena: ArenaDefinition, seed: number) {
    this.config = config
    this.seed = seed
    this.world = new World(config, arena)
    this.stepSeconds = 1 / config.stepsPerSecond
    this.durationSteps = secondsToSteps(config.matchDurationSeconds, config)
    this.repathSteps = Math.max(1, secondsToSteps(config.navigation.repathIntervalSeconds, config))
    const clearance = Math.max(config.chaser.radius, config.shooter.radius) + NAVIGATION_MARGIN
    this.navigation = new NavigationGrid(arena, config.navigation.cellSize, clearance)
    this.navigation.setTarget(this.world.player.x, this.world.player.y)
    this.spawner = new Spawner(config, new SeededRandom(seed))
  }

  get status(): SessionStatus {
    return this.currentStatus
  }

  get remainingSteps(): number {
    return Math.max(0, this.durationSteps - this.world.step)
  }

  get result(): MatchResult | null {
    if (this.currentStatus.kind !== 'finished') {
      return null
    }
    return {
      score: this.world.score,
      activeDurationMs: Math.round((this.world.step * 1000) / this.config.stepsPerSecond),
      endReason: this.currentStatus.reason,
    }
  }

  start(): void {
    if (this.currentStatus.kind === 'ready') {
      this.currentStatus = { kind: 'running' }
    }
  }

  pause(reason: PauseReason): void {
    if (this.currentStatus.kind === 'running') {
      this.currentStatus = { kind: 'paused', reason }
    }
  }

  resume(): void {
    if (this.currentStatus.kind === 'paused') {
      this.currentStatus = { kind: 'running' }
    }
  }

  /** Ends the match without a result, for example when the player leaves the screen. */
  abandon(): void {
    if (this.currentStatus.kind !== 'finished') {
      this.currentStatus = { kind: 'abandoned' }
    }
  }

  drainEvents(): GameEvent[] {
    return this.world.events.splice(0)
  }

  /**
   * Advances the match by one fixed step. Does nothing unless it is running.
   *
   * Order: intents, movement and collisions (including Chaser contact),
   * projectiles already in flight, new shots and spawns, then time. A phase
   * that destroys the player ends the match before any later phase runs, so
   * death wins over a timeout reached in the same step.
   */
  step(input: InputSnapshot): void {
    if (this.currentStatus.kind !== 'running') {
      return
    }
    const { world, config, stepSeconds } = this
    const player = world.player
    world.savePreviousPoses()
    if (world.step % this.repathSteps === 0) {
      this.navigation.setTarget(player.x, player.y)
    }

    player.turnIntent = input.turn
    player.throttle = input.thrust
    updateEnemyIntents(world, this.navigation, config, stepSeconds)

    moveShip(player, stepSeconds)
    for (const enemy of world.enemies) {
      moveShip(enemy, stepSeconds)
    }
    separateEnemies(world)
    keepOnOpenWater(player, world.arena)
    for (const enemy of world.enemies) {
      keepOnOpenWater(enemy, world.arena)
    }
    resolveChaserContacts(world, config)
    if (this.endIfPlayerDestroyed()) {
      return
    }

    updateProjectiles(world)
    if (this.endIfPlayerDestroyed()) {
      return
    }

    // Nothing is fired or spawned at the closing instant of the match.
    const isLastStep = world.step + 1 >= this.durationSteps
    if (!isLastStep) {
      firePlayerCannons(world, input, config)
      fireShooterCannons(world, config)
      this.spawner.update(world, this.navigation)
    }

    world.step += 1
    if (world.step >= this.durationSteps) {
      this.finish('timeout')
    }
    world.removeInactive()
  }

  /** The step that destroys the player still counts as played time. */
  private endIfPlayerDestroyed(): boolean {
    if (this.world.player.alive) {
      return false
    }
    this.world.step += 1
    this.finish('death')
    this.world.removeInactive()
    return true
  }

  private finish(reason: EndReason): void {
    this.currentStatus = { kind: 'finished', reason }
    this.world.emit({ type: 'matchEnded', reason })
  }
}
