import type { ShipPlacement } from '../config/ArenaDefinition.ts'
import type { EnemyKind, PlayerConfig, ShipStats } from '../config/GameplayConfig.ts'
import type { Point } from './math/geometry.ts'

export type Faction = 'player' | 'enemy'
export type ShipKind = 'player' | EnemyKind

type ShipState = {
  readonly id: number
  readonly faction: Faction
  readonly radius: number
  readonly maxHealth: number
  readonly speed: number
  readonly turnSpeed: number
  x: number
  y: number
  /** Radians; 0 points along +x and angles grow clockwise on screen. */
  angle: number
  /** Pose at the start of the current step, for interpolation and swept tests. */
  previousX: number
  previousY: number
  previousAngle: number
  health: number
  /** False from the moment it is destroyed; it is removed at the end of the step. */
  alive: boolean
  /** Intent for the current step, set by input or AI and consumed by movement. */
  turnIntent: number
  throttle: boolean
}

export type PlayerShip = ShipState & {
  readonly kind: 'player'
  /** Step from which each cannon may fire again. */
  frontReadyAt: number
  leftReadyAt: number
  rightReadyAt: number
}

export type NavigationState = {
  /** Point to steer at while the player is out of sight; null means none yet. */
  waypoint: Point | null
  nextRepathAt: number
}

export type ChaserShip = ShipState & {
  readonly kind: 'chaser'
  navigation: NavigationState
}

export type ShooterShip = ShipState & {
  readonly kind: 'shooter'
  navigation: NavigationState
  cannonReadyAt: number
  /** Holding position to fire; released with hysteresis to avoid jitter. */
  engaged: boolean
}

export type EnemyShip = ChaserShip | ShooterShip
export type Ship = PlayerShip | EnemyShip

export type Projectile = {
  readonly id: number
  readonly ownerId: number
  readonly faction: Faction
  readonly damage: number
  readonly radius: number
  /** Displacement per simulation step. */
  readonly stepX: number
  readonly stepY: number
  /** Step at which it disappears if it has not hit anything. */
  readonly expiresAt: number
  x: number
  y: number
  previousX: number
  previousY: number
  /** False once it hit something, expired or left the arena. */
  active: boolean
}

function shipState(id: number, faction: Faction, stats: ShipStats, placement: ShipPlacement): ShipState {
  return {
    id,
    faction,
    radius: stats.radius,
    maxHealth: stats.maxHealth,
    speed: stats.speed,
    turnSpeed: stats.turnSpeed,
    x: placement.x,
    y: placement.y,
    angle: placement.angle,
    previousX: placement.x,
    previousY: placement.y,
    previousAngle: placement.angle,
    health: stats.maxHealth,
    alive: true,
    turnIntent: 0,
    throttle: false,
  }
}

export function createPlayerShip(id: number, config: PlayerConfig, placement: ShipPlacement): PlayerShip {
  return {
    ...shipState(id, 'player', config, placement),
    kind: 'player',
    frontReadyAt: 0,
    leftReadyAt: 0,
    rightReadyAt: 0,
  }
}

export function createChaserShip(id: number, stats: ShipStats, placement: ShipPlacement): ChaserShip {
  return {
    ...shipState(id, 'enemy', stats, placement),
    kind: 'chaser',
    navigation: { waypoint: null, nextRepathAt: 0 },
  }
}

export function createShooterShip(
  id: number,
  stats: ShipStats,
  placement: ShipPlacement,
  firstShotAt: number,
): ShooterShip {
  return {
    ...shipState(id, 'enemy', stats, placement),
    kind: 'shooter',
    navigation: { waypoint: null, nextRepathAt: 0 },
    cannonReadyAt: firstShotAt,
    engaged: false,
  }
}
