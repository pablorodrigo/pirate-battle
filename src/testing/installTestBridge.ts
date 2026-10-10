import type { Ship } from '../game/core/entities.ts'
import type { GameRuntime } from '../game/runtime/GameRuntime.ts'
import { testHooks } from '../game/runtime/testHooks.ts'
import type { BridgeMatchState, BridgeShip } from './bridgeTypes.ts'

function describeShip(ship: Ship): BridgeShip {
  return { id: ship.id, kind: ship.kind, x: ship.x, y: ship.y, angle: ship.angle, health: ship.health }
}

function describeMatch(runtime: GameRuntime): BridgeMatchState {
  const { world } = runtime
  return {
    status: runtime.status.kind,
    step: world.step,
    score: world.score,
    player: describeShip(world.player),
    enemies: world.enemies.map(describeShip),
    projectiles: world.projectiles.map((projectile) => ({
      id: projectile.id,
      faction: projectile.faction,
      x: projectile.x,
      y: projectile.y,
      stepX: projectile.stepX,
      stepY: projectile.stepY,
    })),
  }
}

/**
 * Exposes `window.__PIRATE_BATTLE__` for the end-to-end tests: it reads the
 * current match and advances its manual clock. Scenarios are read from
 * `window.__PIRATE_BATTLE_SCENARIO__` when a match starts. Only the e2e build
 * loads this module.
 */
export function installTestBridge(): void {
  let active: GameRuntime | null = null
  testHooks.current = {
    scenario: () => window.__PIRATE_BATTLE_SCENARIO__ ?? {},
    attach: (runtime) => {
      active = runtime
    },
    detach: (runtime) => {
      if (active === runtime) {
        active = null
      }
    },
  }
  window.__PIRATE_BATTLE__ = {
    state: () => (active ? describeMatch(active) : null),
    advance: (steps) => {
      active?.advanceSteps(steps)
    },
  }
}
