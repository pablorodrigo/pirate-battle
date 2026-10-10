import { describe, expect, it } from 'vitest'
import type { ArenaDefinition } from '../../config/ArenaDefinition.ts'
import { defaultGameplayConfig as config } from '../../config/defaultConfig.ts'
import { createChaserShip } from '../entities.ts'
import { IDLE_INPUT, type InputSnapshot } from '../input.ts'
import { World } from '../World.ts'
import { firePlayerCannons, spawnProjectile, updateProjectiles } from './combat.ts'

const arena: ArenaDefinition = {
  width: 2000,
  height: 600,
  islands: [{ x: 600, y: 200, width: 20, height: 200 }],
  playerStart: { x: 100, y: 300, angle: 0 },
  safeSpawnPoints: [],
}

function createWorld(): World {
  return new World(config, arena)
}

function addChaser(world: World, x: number, y: number) {
  const chaser = createChaserShip(world.nextId(), config.chaser, { x, y, angle: Math.PI })
  world.enemies.push(chaser)
  return chaser
}

/** Runs the projectile phase and the end-of-step bookkeeping, like a session step. */
function advance(world: World, steps = 1): void {
  for (let i = 0; i < steps; i += 1) {
    world.savePreviousPoses()
    updateProjectiles(world)
    world.step += 1
    world.removeInactive()
  }
}

const fire = (overrides: Partial<InputSnapshot>): InputSnapshot => ({ ...IDLE_INPUT, ...overrides })

describe('player cannons', () => {
  it('fires one projectile ahead of the bow and respects the front cooldown', () => {
    const world = createWorld()
    firePlayerCannons(world, fire({ fireFront: true }), config)

    expect(world.projectiles).toHaveLength(1)
    const [shot] = world.projectiles
    expect(shot?.x).toBeCloseTo(100 + config.player.radius + config.projectileRadius + 2)
    expect(shot?.y).toBeCloseTo(300)
    expect(shot?.stepX).toBeCloseTo(config.player.frontCannon.projectileSpeed / 60)

    const cooldownSteps = config.player.frontCannon.cooldownSeconds * 60
    for (let step = 1; step < cooldownSteps; step += 1) {
      world.step = step
      firePlayerCannons(world, fire({ fireFront: true }), config)
    }
    expect(world.projectiles).toHaveLength(1)

    world.step = cooldownSteps
    firePlayerCannons(world, fire({ fireFront: true }), config)
    expect(world.projectiles).toHaveLength(2)
  })

  it('fires three parallel shots per side, each side with its own cooldown', () => {
    const world = createWorld()
    firePlayerCannons(world, fire({ fireLeft: true, fireRight: true }), config)

    expect(world.projectiles).toHaveLength(6)
    const left = world.projectiles.filter((shot) => shot.stepY < 0)
    const right = world.projectiles.filter((shot) => shot.stepY > 0)
    expect(left).toHaveLength(3)
    expect(right).toHaveLength(3)
    for (const shot of [...left, ...right]) {
      expect(shot.stepX).toBeCloseTo(0)
    }
    expect(left.map((shot) => shot.x).sort((a, b) => a - b)).toEqual([86, 100, 114])

    world.step = 1
    firePlayerCannons(world, fire({ fireLeft: true }), config)
    expect(world.projectiles).toHaveLength(6)

    world.step = config.player.sideCannons.cooldownSeconds * 60
    firePlayerCannons(world, fire({ fireLeft: true }), config)
    expect(world.projectiles).toHaveLength(9)
  })
})

describe('projectiles', () => {
  it('travel for their configured lifetime and then disappear', () => {
    const world = new World(config, { ...arena, islands: [] })
    // Shots are fired at the end of a step and start moving on the next one.
    firePlayerCannons(world, fire({ fireFront: true }), config)
    world.step += 1
    const startX = world.projectiles[0]?.x ?? 0
    const { projectileSpeed, projectileLifetimeSeconds } = config.player.frontCannon

    advance(world, projectileLifetimeSeconds * 60)
    expect(world.projectiles).toHaveLength(1)
    expect(world.projectiles[0]?.x).toBeCloseTo(startX + projectileSpeed * projectileLifetimeSeconds)

    advance(world)
    expect(world.projectiles).toHaveLength(0)
  })

  it('stop at an island even when a single step would carry them across it', () => {
    const world = createWorld()
    spawnProjectile(world, world.player, 560, 300, 0, { ...config.player.frontCannon, projectileSpeed: 6000 }, config)

    advance(world)
    expect(world.projectiles).toHaveLength(0)
    expect(world.events).toContainEqual(expect.objectContaining({ type: 'projectileImpact', target: 'island' }))
  })

  it('damage an enemy once each and score one point when it is destroyed', () => {
    const world = createWorld()
    const chaser = addChaser(world, 300, 300)
    firePlayerCannons(world, fire({ fireFront: true }), config)

    advance(world, 20)
    expect(chaser.health).toBe(config.chaser.maxHealth - config.player.frontCannon.damage)
    expect(world.projectiles).toHaveLength(0)
    expect(world.score).toBe(0)

    world.player.frontReadyAt = 0
    firePlayerCannons(world, fire({ fireFront: true }), config)
    advance(world, 20)
    expect(chaser.alive).toBe(false)
    expect(world.enemies).toHaveLength(0)
    expect(world.score).toBe(1)
  })

  it('score a single point when several shots destroy the same enemy in one step', () => {
    const world = createWorld()
    addChaser(world, 300, 300)
    for (const offset of [0, 1, 2]) {
      spawnProjectile(world, world.player, 270 - offset, 300, 0, config.player.frontCannon, config)
    }

    advance(world)
    expect(world.score).toBe(1)
    expect(world.events.filter((event) => event.type === 'shipDestroyed')).toHaveLength(1)
    // The third shot finds no living target and keeps flying.
    expect(world.projectiles).toHaveLength(1)
  })

  it('ignore ships of their own faction', () => {
    const world = createWorld()
    spawnProjectile(world, world.player, 60, 300, 0, config.player.frontCannon, config)

    advance(world, 10)
    expect(world.player.health).toBe(world.player.maxHealth)
    expect(world.projectiles).toHaveLength(1)
  })

  it('are removed when they leave the arena', () => {
    const world = createWorld()
    spawnProjectile(world, world.player, 100, 10, -Math.PI / 2, config.player.frontCannon, config)

    advance(world, 2)
    expect(world.projectiles).toHaveLength(0)
  })
})
