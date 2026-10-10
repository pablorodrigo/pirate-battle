import { describe, expect, it } from 'vitest'
import type { ArenaDefinition } from '../../config/ArenaDefinition.ts'
import { defaultGameplayConfig } from '../../config/defaultConfig.ts'
import { createChaserShip, createPlayerShip } from '../entities.ts'
import { keepOnOpenWater, moveShip, separateShips } from './movement.ts'

const STEP = 1 / 60
const arena: ArenaDefinition = {
  width: 400,
  height: 300,
  islands: [{ x: 200, y: 100, width: 100, height: 100 }],
  playerStart: { x: 100, y: 150, angle: 0 },
  safeSpawnPoints: [],
}

function player(x: number, y: number, angle = 0) {
  return createPlayerShip(1, defaultGameplayConfig.player, { x, y, angle })
}

describe('moveShip', () => {
  it('advances along the bow at the configured speed per second', () => {
    const ship = player(100, 150)
    ship.throttle = true
    for (let i = 0; i < 60; i += 1) {
      moveShip(ship, STEP)
    }
    expect(ship.x).toBeCloseTo(100 + defaultGameplayConfig.player.speed)
    expect(ship.y).toBeCloseTo(150)
  })

  it('turns at the configured angular speed without moving when idle', () => {
    const ship = player(100, 150)
    ship.turnIntent = 1
    for (let i = 0; i < 30; i += 1) {
      moveShip(ship, STEP)
    }
    expect(ship.angle).toBeCloseTo(defaultGameplayConfig.player.turnSpeed / 2)
    expect(ship.x).toBe(100)
  })
})

describe('keepOnOpenWater', () => {
  it('keeps the whole hull inside the arena', () => {
    const ship = player(395, -5)
    keepOnOpenWater(ship, arena)
    expect(ship.x).toBe(arena.width - ship.radius)
    expect(ship.y).toBe(ship.radius)
  })

  it('stops a ship at an island face and lets it slide along it', () => {
    const ship = player(170, 150, Math.PI / 4)
    ship.throttle = true
    for (let i = 0; i < 20; i += 1) {
      moveShip(ship, STEP)
      keepOnOpenWater(ship, arena)
    }
    // Blocked on x by the island's left face, yet still moving down along it.
    const verticalSpeedPerStep = defaultGameplayConfig.player.speed * STEP * Math.SQRT1_2
    expect(ship.x).toBeCloseTo(200 - ship.radius)
    expect(ship.y).toBeCloseTo(150 + 20 * verticalSpeedPerStep)
  })

  it('keeps sailing once it slides past the island corner', () => {
    const ship = player(170, 150, Math.PI / 4)
    ship.throttle = true
    for (let i = 0; i < 120; i += 1) {
      moveShip(ship, STEP)
      keepOnOpenWater(ship, arena)
    }
    expect(ship.x).toBeGreaterThan(300)
    expect(ship.y).toBeGreaterThan(200)
  })
})

describe('separateShips', () => {
  it('moves only the mover when the other ship is fixed', () => {
    const mover = createChaserShip(2, defaultGameplayConfig.chaser, { x: 100, y: 100, angle: 0 })
    const fixed = player(110, 100)
    separateShips(mover, fixed, false)
    expect(fixed.x).toBe(110)
    expect(fixed.x - mover.x).toBeCloseTo(mover.radius + fixed.radius)
  })
})
