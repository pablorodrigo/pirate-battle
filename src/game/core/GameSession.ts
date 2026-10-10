import type { ArenaDefinition } from '../config/ArenaDefinition.ts'
import type { GameplayConfig } from '../config/GameplayConfig.ts'
import type { EndReason, GameEvent } from './events.ts'
import type { InputSnapshot } from './input.ts'
import { firePlayerCannons, updateProjectiles } from './systems/combat.ts'
import { keepOnOpenWater, moveShip } from './systems/movement.ts'
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

/**
 * One match: the rules state machine around a World. It only advances while
 * running, one fixed step at a time, so the outcome never depends on the
 * frame rate.
 */
export class GameSession {
  readonly config: GameplayConfig
  readonly seed: number
  readonly world: World
  readonly stepSeconds: number
  readonly durationSteps: number
  private currentStatus: SessionStatus = { kind: 'ready' }

  constructor(config: GameplayConfig, arena: ArenaDefinition, seed: number) {
    this.config = config
    this.seed = seed
    this.world = new World(config, arena)
    this.stepSeconds = 1 / config.stepsPerSecond
    this.durationSteps = Math.round(config.matchDurationSeconds * config.stepsPerSecond)
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
   * Order: intents, movement and collisions, projectiles already in flight,
   * new shots, then time. A phase that destroys the player ends the match
   * before any later phase runs.
   */
  step(input: InputSnapshot): void {
    if (this.currentStatus.kind !== 'running') {
      return
    }
    const { world, config } = this
    world.savePreviousPoses()

    const player = world.player
    player.turnIntent = input.turn
    player.throttle = input.thrust

    moveShip(player, this.stepSeconds)
    keepOnOpenWater(player, world.arena)

    updateProjectiles(world)
    if (this.endIfPlayerDestroyed()) {
      return
    }

    // Nothing is fired at the closing instant of the match.
    const isLastStep = world.step + 1 >= this.durationSteps
    if (!isLastStep) {
      firePlayerCannons(world, input, config)
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
