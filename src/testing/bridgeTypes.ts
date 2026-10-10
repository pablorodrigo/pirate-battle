import type { MatchScenario } from '../game/runtime/testHooks.ts'

export type { MatchScenario }

export type BridgeShip = {
  readonly id: number
  readonly kind: 'player' | 'chaser' | 'shooter'
  readonly x: number
  readonly y: number
  readonly angle: number
  readonly health: number
}

export type BridgeProjectile = {
  readonly id: number
  readonly faction: 'player' | 'enemy'
  readonly x: number
  readonly y: number
  readonly stepX: number
  readonly stepY: number
}

export type BridgeRect = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Serializable view of a match, read by the end-to-end tests. */
export type BridgeMatchState = {
  readonly status: 'ready' | 'running' | 'paused' | 'finished' | 'abandoned'
  /** Colliders of the match's islands and reefs. */
  readonly islands: readonly BridgeRect[]
  readonly step: number
  readonly score: number
  readonly player: BridgeShip
  readonly enemies: readonly BridgeShip[]
  readonly projectiles: readonly BridgeProjectile[]
}

/** Observes the match and advances its clock; it can never change game state directly. */
export type PirateBattleTestBridge = {
  readonly state: () => BridgeMatchState | null
  readonly advance: (steps: number) => void
}

declare global {
  interface Window {
    __PIRATE_BATTLE__?: PirateBattleTestBridge
    __PIRATE_BATTLE_SCENARIO__?: MatchScenario
  }
}
