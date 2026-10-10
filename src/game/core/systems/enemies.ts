import type { GameplayConfig } from '../../config/GameplayConfig.ts'
import type { ChaserShip, EnemyShip, ShooterShip, Ship } from '../entities.ts'
import { angleDifference, clamp, distanceSquared, type Point } from '../math/geometry.ts'
import type { NavigationGrid } from '../navigation/NavigationGrid.ts'
import type { World } from '../World.ts'
import { damageShip, fireFromBow, hasClearShot, secondsToSteps } from './combat.ts'
import { separateShips } from './movement.ts'

/** Beyond this angle off the bow a ship turns in place instead of sailing away. */
const TURN_IN_PLACE_ANGLE = Math.PI * 0.6
/** A waypoint closer than this is replaced right away. */
const WAYPOINT_REACHED_DISTANCE = 12

/** Sets turn and throttle to head for a point, turning proportionally so it never overshoots. */
function steerToward(ship: Ship, x: number, y: number, stepSeconds: number, sail: boolean): void {
  const difference = angleDifference(ship.angle, Math.atan2(y - ship.y, x - ship.x))
  ship.turnIntent = clamp(difference / (ship.turnSpeed * stepSeconds), -1, 1)
  ship.throttle = sail && Math.abs(difference) < TURN_IN_PLACE_ANGLE
}

/** Heads straight for the player when in sight, otherwise follows the navigation grid. */
function navigationTarget(ship: EnemyShip, world: World, grid: NavigationGrid, config: GameplayConfig): Point {
  const player = world.player
  if (grid.hasLineOfSight(ship.x, ship.y, player.x, player.y)) {
    ship.navigation.waypoint = null
    return player
  }
  const navigation = ship.navigation
  const current = navigation.waypoint
  const reached =
    current !== null &&
    distanceSquared(ship.x, ship.y, current.x, current.y) < WAYPOINT_REACHED_DISTANCE ** 2
  if (current === null || reached || world.step >= navigation.nextRepathAt) {
    navigation.waypoint = grid.nextWaypoint(ship.x, ship.y)
    navigation.nextRepathAt = world.step + secondsToSteps(config.navigation.repathIntervalSeconds, config)
  }
  return navigation.waypoint ?? player
}

function updateChaser(chaser: ChaserShip, world: World, grid: NavigationGrid, config: GameplayConfig, stepSeconds: number): void {
  const target = navigationTarget(chaser, world, grid, config)
  steerToward(chaser, target.x, target.y, stepSeconds, true)
}

function updateShooter(
  shooter: ShooterShip,
  world: World,
  grid: NavigationGrid,
  config: GameplayConfig,
  stepSeconds: number,
): void {
  const player = world.player
  const { range, rangeHysteresis } = config.shooter
  const distance = Math.hypot(player.x - shooter.x, player.y - shooter.y)
  const clearShot = hasClearShot(world, shooter.x, shooter.y, player.x, player.y, config.projectileRadius)
  // Hysteresis: once engaged, it holds position until clearly out of range.
  if (shooter.engaged) {
    shooter.engaged = clearShot && distance <= range + rangeHysteresis
  } else {
    shooter.engaged = clearShot && distance <= range
  }

  if (shooter.engaged) {
    steerToward(shooter, player.x, player.y, stepSeconds, false)
    return
  }
  const target = navigationTarget(shooter, world, grid, config)
  steerToward(shooter, target.x, target.y, stepSeconds, true)
}

/** Strategy per enemy kind: decides turn and throttle for this step. */
export function updateEnemyIntents(world: World, grid: NavigationGrid, config: GameplayConfig, stepSeconds: number): void {
  for (const enemy of world.enemies) {
    if (!enemy.alive) {
      continue
    }
    if (enemy.kind === 'chaser') {
      updateChaser(enemy, world, grid, config, stepSeconds)
    } else {
      updateShooter(enemy, world, grid, config, stepSeconds)
    }
  }
}

/** Keeps enemies from stacking and Shooters from sitting on the player. */
export function separateEnemies(world: World): void {
  const { enemies, player } = world
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i]
    if (!enemy?.alive) {
      continue
    }
    for (let j = i + 1; j < enemies.length; j += 1) {
      const other = enemies[j]
      if (other?.alive) {
        separateShips(enemy, other, true)
      }
    }
    if (enemy.kind === 'shooter' && player.alive) {
      separateShips(enemy, player, false)
    }
  }
}

/**
 * A Chaser that touches the player sinks on the spot and deals its contact
 * damage once. Sinking this way never scores a point.
 */
export function resolveChaserContacts(world: World, config: GameplayConfig): void {
  const player = world.player
  for (const enemy of world.enemies) {
    if (enemy.kind !== 'chaser' || !enemy.alive || !player.alive) {
      continue
    }
    const reach = enemy.radius + player.radius
    if (distanceSquared(enemy.x, enemy.y, player.x, player.y) <= reach * reach) {
      damageShip(world, enemy, enemy.health, 'collision', 'player')
      damageShip(world, player, config.chaser.contactDamage, 'collision', 'enemy')
    }
  }
}

/** Engaged Shooters fire when in range, aimed within tolerance, with a clear line and a ready cannon. */
export function fireShooterCannons(world: World, config: GameplayConfig): void {
  const player = world.player
  if (!player.alive) {
    return
  }
  const { range, aimToleranceRadians, cannon } = config.shooter
  for (const enemy of world.enemies) {
    if (enemy.kind !== 'shooter' || !enemy.alive || !enemy.engaged || world.step < enemy.cannonReadyAt) {
      continue
    }
    const inRange = distanceSquared(enemy.x, enemy.y, player.x, player.y) <= range * range
    const aim = Math.abs(angleDifference(enemy.angle, Math.atan2(player.y - enemy.y, player.x - enemy.x)))
    if (!inRange || aim > aimToleranceRadians) {
      continue
    }
    if (!hasClearShot(world, enemy.x, enemy.y, player.x, player.y, config.projectileRadius)) {
      continue
    }
    fireFromBow(world, enemy, cannon, config, 'enemy')
    enemy.cannonReadyAt = world.step + secondsToSteps(cannon.cooldownSeconds, config)
  }
}
