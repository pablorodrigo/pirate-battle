import type { GameRuntime } from './GameRuntime.ts'

export type ScenarioShip = {
  readonly kind: 'chaser' | 'shooter'
  readonly x: number
  readonly y: number
  readonly angle: number
}

/**
 * Test-only setup applied before a match starts: seed, manual clock and the
 * initial placement of ships. It never edits health or score, and rules run
 * unchanged once the match starts.
 */
export type MatchScenario = {
  readonly seed?: number
  /** The simulation advances only when a test asks, never with wall-clock time. */
  readonly manualClock?: boolean
  readonly spawns?: boolean
  readonly player?: { readonly x: number; readonly y: number; readonly angle: number }
  readonly enemies?: readonly ScenarioShip[]
}

export type TestHooks = {
  readonly scenario: () => MatchScenario
  readonly attach: (runtime: GameRuntime) => void
  readonly detach: (runtime: GameRuntime) => void
}

/** Set only by the end-to-end build's test bridge; always null in the public bundle. */
export const testHooks: { current: TestHooks | null } = { current: null }
