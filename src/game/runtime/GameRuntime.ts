import type { EndReason, GameEvent } from '../core/events.ts'
import type { GameSession, MatchResult, PauseReason, SessionStatus } from '../core/GameSession.ts'
import type { World } from '../core/World.ts'
import { InputManager } from '../input/InputManager.ts'
import { KeyboardInput } from '../input/KeyboardInput.ts'
import { FixedStepLoop } from './FixedStepLoop.ts'

/** Summary of the match for the React HUD. A new object only when a field changes. */
export type HudSnapshot = {
  readonly status: SessionStatus['kind']
  readonly pauseReason: PauseReason | null
  readonly endReason: EndReason | null
  readonly score: number
  readonly health: number
  readonly maxHealth: number
  readonly remainingSeconds: number
}

/** What the runtime needs from the presentation layer. */
export type MatchView = {
  /** Calls `callback` once per animation frame; returns a function that stops it. */
  onFrame(callback: (elapsedMs: number) => void): () => void
  render(world: World, alpha: number, events: readonly GameEvent[]): void
}

export type GameRuntimeOptions = {
  readonly session: GameSession
  readonly view: MatchView
  readonly onFinished: (result: MatchResult) => void
  /** Test builds only: steps come from advanceSteps(), never from frame time. */
  readonly manualClock?: boolean
}

/**
 * Drives one match: feeds frame time to the fixed-step loop, input to the
 * session and the resulting state to the view, and exposes a HUD snapshot
 * through `subscribe`/`getHudSnapshot` (compatible with useSyncExternalStore).
 */
export class GameRuntime {
  readonly input = new InputManager()
  private readonly session: GameSession
  private readonly view: MatchView
  private readonly onFinished: (result: MatchResult) => void
  private readonly manualClock: boolean
  private readonly loop: FixedStepLoop
  private readonly keyboard: KeyboardInput
  private readonly listeners = new Set<() => void>()
  private hud: HudSnapshot
  private stopFrames: (() => void) | null = null
  private finishReported = false
  private disposed = false

  constructor(options: GameRuntimeOptions) {
    this.session = options.session
    this.view = options.view
    this.onFinished = options.onFinished
    this.manualClock = options.manualClock ?? false
    this.loop = new FixedStepLoop({
      stepsPerSecond: options.session.config.stepsPerSecond,
      maxFrameMs: 250,
      maxStepsPerFrame: 15,
    })
    this.keyboard = new KeyboardInput({
      input: this.input,
      isCapturing: () => this.session.status.kind === 'running',
      onPauseKey: () => this.togglePause(),
    })
    this.hud = this.readHud()
  }

  get world(): World {
    return this.session.world
  }

  get status(): SessionStatus {
    return this.session.status
  }

  start(): void {
    if (this.disposed || this.stopFrames) {
      return
    }
    this.keyboard.attach()
    window.addEventListener('blur', this.onWindowBlur)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.stopFrames = this.view.onFrame(this.onFrame)
    this.session.start()
    this.publishHud()
  }

  pause(reason: PauseReason): void {
    this.session.pause(reason)
    this.input.clear()
    this.publishHud()
  }

  /** Resuming always needs a player action; held inputs must be pressed again. */
  resume(): void {
    this.input.clear()
    this.session.resume()
    this.publishHud()
  }

  /** Stops the match and releases every listener. Safe to call more than once. */
  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.keyboard.detach()
    window.removeEventListener('blur', this.onWindowBlur)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.stopFrames?.()
    this.stopFrames = null
    this.session.abandon()
    this.input.clear()
    this.listeners.clear()
  }

  /** Runs whole simulation steps on demand, with the live input. Used by the test bridge. */
  advanceSteps(count: number): void {
    const { session } = this
    for (let i = 0; i < count && session.status.kind === 'running'; i += 1) {
      session.step(this.input.snapshot())
    }
    this.present(1)
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getHudSnapshot = (): HudSnapshot => this.hud

  private togglePause(): void {
    const { kind } = this.session.status
    if (kind === 'running') {
      this.pause('manual')
    } else if (kind === 'paused') {
      this.resume()
    }
  }

  private readonly onFrame = (elapsedMs: number): void => {
    const { session } = this
    if (this.manualClock) {
      this.present(1)
      return
    }
    // Paused time never reaches the loop: frames only feed it while running.
    if (session.status.kind === 'running') {
      const steps = this.loop.advance(elapsedMs)
      const input = this.input.snapshot()
      for (let i = 0; i < steps && session.status.kind === 'running'; i += 1) {
        session.step(input)
      }
    }
    this.present(this.loop.alpha)
  }

  /** Draws the latest state, refreshes the HUD and reports the end of the match once. */
  private present(alpha: number): void {
    const { session } = this
    this.view.render(session.world, alpha, session.drainEvents())
    this.publishHud()
    const result = session.result
    if (result && !this.finishReported) {
      this.finishReported = true
      this.input.clear()
      this.onFinished(result)
    }
  }

  private readonly onWindowBlur = (): void => {
    this.pause('blur')
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.pause('hidden')
    }
  }

  private readHud(): HudSnapshot {
    const { session } = this
    const { status, world, config } = session
    return {
      status: status.kind,
      pauseReason: status.kind === 'paused' ? status.reason : null,
      endReason: status.kind === 'finished' ? status.reason : null,
      score: world.score,
      health: Math.max(0, Math.ceil(world.player.health)),
      maxHealth: world.player.maxHealth,
      remainingSeconds: Math.ceil(session.remainingSteps / config.stepsPerSecond),
    }
  }

  private publishHud(): void {
    const next = this.readHud()
    const current = this.hud
    const changed = (Object.keys(next) as (keyof HudSnapshot)[]).some((key) => next[key] !== current[key])
    if (!changed) {
      return
    }
    this.hud = next
    for (const listener of this.listeners) {
      listener()
    }
  }
}

/** Seed for a new match from the platform's random source. */
export function createSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1
}
