import type { GameplayConfig } from '../config/GameplayConfig.ts'
import { createChaserShip, createShooterShip } from '../core/entities.ts'
import type { GameSession } from '../core/GameSession.ts'
import { secondsToSteps } from '../core/systems/combat.ts'
import type { MatchScenario } from './testHooks.ts'

/** Places the scenario's ships before the match starts. */
export function applyScenario(session: GameSession, scenario: MatchScenario, config: GameplayConfig): void {
  const { world } = session
  if (scenario.player) {
    const { player } = world
    player.x = player.previousX = scenario.player.x
    player.y = player.previousY = scenario.player.y
    player.angle = player.previousAngle = scenario.player.angle
  }
  const firstShotAt = world.step + secondsToSteps(config.shooter.cannon.cooldownSeconds, config)
  for (const ship of scenario.enemies ?? []) {
    const placement = { x: ship.x, y: ship.y, angle: ship.angle }
    world.enemies.push(
      ship.kind === 'chaser'
        ? createChaserShip(world.nextId(), config.chaser, placement)
        : createShooterShip(world.nextId(), config.shooter, placement, firstShotAt),
    )
  }
}
