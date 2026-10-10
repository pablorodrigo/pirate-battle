import type { ArenaDefinition } from '../../config/ArenaDefinition.ts'
import type { Ship } from '../entities.ts'
import { clamp, normalizeAngle, resolveCircleRect } from '../math/geometry.ts'

/** Turns and advances a ship according to its intent for this step. */
export function moveShip(ship: Ship, stepSeconds: number): void {
  ship.angle = normalizeAngle(ship.angle + ship.turnIntent * ship.turnSpeed * stepSeconds)
  if (ship.throttle) {
    ship.x += Math.cos(ship.angle) * ship.speed * stepSeconds
    ship.y += Math.sin(ship.angle) * ship.speed * stepSeconds
  }
}

/**
 * Pushes a ship out of islands and back inside the arena. Ships move at most a
 * few units per step, far less than their radius, so they cannot tunnel
 * through an island between two steps.
 */
export function keepOnOpenWater(ship: Ship, arena: ArenaDefinition): void {
  // A second pass settles ships pushed from one obstacle into another.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const island of arena.islands) {
      const corrected = resolveCircleRect(ship.x, ship.y, ship.radius, island)
      if (corrected) {
        ship.x = corrected.x
        ship.y = corrected.y
      }
    }
    ship.x = clamp(ship.x, ship.radius, arena.width - ship.radius)
    ship.y = clamp(ship.y, ship.radius, arena.height - ship.radius)
  }
}

/** Pushes two overlapping ships apart, moving only `mover` when the other one is fixed. */
export function separateShips(mover: Ship, other: Ship, moveOther: boolean): void {
  const dx = mover.x - other.x
  const dy = mover.y - other.y
  const minDistance = mover.radius + other.radius
  const distanceSq = dx * dx + dy * dy
  if (distanceSq >= minDistance * minDistance) {
    return
  }
  const distance = Math.sqrt(distanceSq)
  // Coincident centers have no direction; separate them along x.
  const nx = distance > 0 ? dx / distance : 1
  const ny = distance > 0 ? dy / distance : 0
  const overlap = minDistance - distance
  const share = moveOther ? overlap / 2 : overlap
  mover.x += nx * share
  mover.y += ny * share
  if (moveOther) {
    other.x -= nx * share
    other.y -= ny * share
  }
}
