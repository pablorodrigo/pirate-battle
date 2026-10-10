import type { CannonStats, GameplayConfig } from '../../config/GameplayConfig.ts'
import type { CannonKind } from '../events.ts'
import type { Ship } from '../entities.ts'
import type { InputSnapshot } from '../input.ts'
import { circlesTimeOfImpact, expandRect, segmentRectEntry } from '../math/geometry.ts'
import type { World } from '../World.ts'

/** Gap between a hull and the projectiles it fires, so a shot never starts inside its own ship. */
const MUZZLE_CLEARANCE = 2

export function secondsToSteps(seconds: number, config: GameplayConfig): number {
  return Math.round(seconds * config.stepsPerSecond)
}

/** True when a projectile of this radius could fly between the points without hitting an island. */
export function hasClearShot(
  world: World,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius: number,
): boolean {
  return world.arena.islands.every(
    (island) => segmentRectEntry(fromX, fromY, toX, toY, expandRect(island, radius)) === null,
  )
}

/**
 * Applies damage to a living ship. The alive → destroyed transition happens
 * once, and only a player projectile destroying an enemy scores a point.
 */
export function damageShip(
  world: World,
  ship: Ship,
  damage: number,
  cause: 'projectile' | 'collision',
  attacker: Ship['faction'],
): void {
  if (!ship.alive) {
    return
  }
  ship.health = Math.max(0, ship.health - damage)
  world.emit({ type: 'shipDamaged', shipId: ship.id, kind: ship.kind, damage, health: ship.health })
  if (ship.health > 0) {
    return
  }
  ship.alive = false
  world.emit({
    type: 'shipDestroyed',
    shipId: ship.id,
    kind: ship.kind,
    cause,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
  })
  if (ship.faction === 'enemy' && attacker === 'player' && cause === 'projectile') {
    world.score += 1
    world.emit({ type: 'scoreChanged', score: world.score })
  }
}

export function spawnProjectile(
  world: World,
  owner: Ship,
  x: number,
  y: number,
  direction: number,
  cannon: CannonStats,
  config: GameplayConfig,
): void {
  const distancePerStep = cannon.projectileSpeed / config.stepsPerSecond
  world.projectiles.push({
    id: world.nextId(),
    ownerId: owner.id,
    faction: owner.faction,
    damage: cannon.damage,
    radius: config.projectileRadius,
    stepX: Math.cos(direction) * distancePerStep,
    stepY: Math.sin(direction) * distancePerStep,
    // Fired during this step, it moves from the next one for its whole lifetime.
    expiresAt: world.step + secondsToSteps(cannon.projectileLifetimeSeconds, config),
    x,
    y,
    previousX: x,
    previousY: y,
    active: true,
  })
}

/** Fires one projectile straight ahead from the bow. */
export function fireFromBow(world: World, ship: Ship, cannon: CannonStats, config: GameplayConfig, kind: CannonKind): void {
  const offset = ship.radius + config.projectileRadius + MUZZLE_CLEARANCE
  const x = ship.x + Math.cos(ship.angle) * offset
  const y = ship.y + Math.sin(ship.angle) * offset
  spawnProjectile(world, ship, x, y, ship.angle, cannon, config)
  world.emit({ type: 'shotFired', shipId: ship.id, cannon: kind, x, y, angle: ship.angle })
}

/** Fires parallel projectiles from one side, spaced along the hull. */
function fireBroadside(world: World, ship: Ship, side: -1 | 1, config: GameplayConfig): void {
  const cannons = config.player.sideCannons
  const direction = ship.angle + (side * Math.PI) / 2
  const forwardX = Math.cos(ship.angle)
  const forwardY = Math.sin(ship.angle)
  const outward = ship.radius + config.projectileRadius + MUZZLE_CLEARANCE
  const sideX = Math.cos(direction) * outward
  const sideY = Math.sin(direction) * outward
  const middle = (cannons.count - 1) / 2
  for (let index = 0; index < cannons.count; index += 1) {
    const along = (index - middle) * cannons.spacing
    spawnProjectile(
      world,
      ship,
      ship.x + forwardX * along + sideX,
      ship.y + forwardY * along + sideY,
      direction,
      cannons,
      config,
    )
  }
  world.emit({
    type: 'shotFired',
    shipId: ship.id,
    cannon: side < 0 ? 'left' : 'right',
    x: ship.x + sideX,
    y: ship.y + sideY,
    angle: direction,
  })
}

/** Fires every requested player cannon whose cooldown is over. */
export function firePlayerCannons(world: World, input: InputSnapshot, config: GameplayConfig): void {
  const player = world.player
  if (!player.alive) {
    return
  }
  const { frontCannon, sideCannons } = config.player
  if (input.fireFront && world.step >= player.frontReadyAt) {
    fireFromBow(world, player, frontCannon, config, 'front')
    player.frontReadyAt = world.step + secondsToSteps(frontCannon.cooldownSeconds, config)
  }
  if (input.fireLeft && world.step >= player.leftReadyAt) {
    fireBroadside(world, player, -1, config)
    player.leftReadyAt = world.step + secondsToSteps(sideCannons.cooldownSeconds, config)
  }
  if (input.fireRight && world.step >= player.rightReadyAt) {
    fireBroadside(world, player, 1, config)
    player.rightReadyAt = world.step + secondsToSteps(sideCannons.cooldownSeconds, config)
  }
}

/**
 * Moves every projectile along this step's segment and resolves its first
 * impact. Islands are tested against the swept segment and ships against
 * their own motion during the step, so fast projectiles never tunnel. On a
 * tie the island wins, then the ship with the lowest id.
 */
export function updateProjectiles(world: World): void {
  const { arena } = world
  for (const projectile of world.projectiles) {
    if (!projectile.active) {
      continue
    }
    if (world.step > projectile.expiresAt) {
      projectile.active = false
      continue
    }
    const startX = projectile.x
    const startY = projectile.y
    const endX = startX + projectile.stepX
    const endY = startY + projectile.stepY

    let impactTime = Number.POSITIVE_INFINITY
    let target: Ship | null = null
    for (const island of arena.islands) {
      const time = segmentRectEntry(startX, startY, endX, endY, expandRect(island, projectile.radius))
      if (time !== null && time < impactTime) {
        impactTime = time
      }
    }
    const targets = projectile.faction === 'player' ? world.enemies : [world.player]
    for (const ship of targets) {
      if (!ship.alive) {
        continue
      }
      const time = circlesTimeOfImpact(
        startX - ship.previousX,
        startY - ship.previousY,
        projectile.stepX - (ship.x - ship.previousX),
        projectile.stepY - (ship.y - ship.previousY),
        projectile.radius + ship.radius,
      )
      if (time !== null && time < impactTime) {
        impactTime = time
        target = ship
      }
    }

    if (impactTime === Number.POSITIVE_INFINITY) {
      projectile.x = endX
      projectile.y = endY
      const outside = endX < 0 || endY < 0 || endX > arena.width || endY > arena.height
      if (outside) {
        projectile.active = false
      }
      continue
    }

    projectile.x = startX + projectile.stepX * impactTime
    projectile.y = startY + projectile.stepY * impactTime
    projectile.active = false
    world.emit({ type: 'projectileImpact', x: projectile.x, y: projectile.y, target: target ? 'ship' : 'island' })
    if (target) {
      damageShip(world, target, projectile.damage, 'projectile', projectile.faction)
    }
  }
}
