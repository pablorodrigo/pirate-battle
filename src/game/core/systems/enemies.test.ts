import { describe, expect, it } from 'vitest'
import type { ArenaDefinition } from '../../config/ArenaDefinition.ts'
import type { GameplayConfig } from '../../config/GameplayConfig.ts'
import { defaultArena } from '../../config/defaultArena.ts'
import { defaultGameplayConfig } from '../../config/defaultConfig.ts'
import { createChaserShip, createShooterShip, type EnemyShip } from '../entities.ts'
import { GameSession } from '../GameSession.ts'
import { IDLE_INPUT } from '../input.ts'
import { resolveCircleRect } from '../math/geometry.ts'

/** No spawns: each test places the enemies it needs. */
const config: GameplayConfig = {
  ...defaultGameplayConfig,
  matchDurationSeconds: 180,
  spawn: { ...defaultGameplayConfig.spawn, intervalSeconds: 1000 },
}

const openSea: ArenaDefinition = {
  width: 1280,
  height: 720,
  islands: [],
  playerStart: { x: 200, y: 360, angle: 0 },
  safeSpawnPoints: [],
}

function sessionWith(arena: ArenaDefinition, place: (session: GameSession) => EnemyShip[]): GameSession {
  const session = new GameSession(config, arena, 7)
  session.world.enemies.push(...place(session))
  session.start()
  return session
}

function runUntil(session: GameSession, done: () => boolean, maxSteps = 60 * 60): number {
  for (let step = 0; step < maxSteps; step += 1) {
    if (done()) {
      return step
    }
    session.step(IDLE_INPUT)
  }
  return maxSteps
}

describe('Chaser', () => {
  it('closes in, rams the player once and sinks without scoring', () => {
    const session = sessionWith(openSea, ({ world }) => [
      createChaserShip(world.nextId(), config.chaser, { x: 700, y: 360, angle: Math.PI / 2 }),
    ])
    const { world } = session

    runUntil(session, () => world.enemies.length === 0)

    expect(world.player.health).toBe(world.player.maxHealth - config.chaser.contactDamage)
    expect(world.score).toBe(0)
    expect(session.drainEvents()).toContainEqual(
      expect.objectContaining({ type: 'shipDestroyed', kind: 'chaser', cause: 'collision' }),
    )
  })

  it('sails around an island to reach a player hidden behind it', () => {
    const session = sessionWith(defaultArena, ({ world }) => [
      createChaserShip(world.nextId(), config.chaser, { x: 900, y: 360, angle: Math.PI }),
    ])
    const { world } = session
    const chaser = world.enemies[0]

    const steps = runUntil(session, () => {
      if (chaser?.alive) {
        for (const island of defaultArena.islands) {
          expect(resolveCircleRect(chaser.x, chaser.y, chaser.radius - 0.01, island)).toBeNull()
        }
      }
      return world.enemies.length === 0
    })

    expect(steps).toBeLessThan(60 * 20)
    expect(world.player.health).toBe(world.player.maxHealth - config.chaser.contactDamage)
  })
})

describe('Shooter', () => {
  it('approaches, holds within range and fires on its cooldown', () => {
    const session = sessionWith(openSea, ({ world }) => [
      createShooterShip(world.nextId(), config.shooter, { x: 900, y: 360, angle: Math.PI }, 0),
    ])
    const { world } = session
    const shooter = world.enemies[0]
    const shots: number[] = []

    for (let step = 0; step < 60 * 12; step += 1) {
      session.step(IDLE_INPUT)
      for (const event of session.drainEvents()) {
        if (event.type === 'shotFired' && event.cannon === 'enemy') {
          shots.push(world.step)
        }
      }
    }

    expect(shooter?.kind === 'shooter' && shooter.engaged).toBe(true)
    const distance = Math.hypot((shooter?.x ?? 0) - world.player.x, (shooter?.y ?? 0) - world.player.y)
    expect(distance).toBeLessThanOrEqual(config.shooter.range + config.shooter.rangeHysteresis)
    expect(shots.length).toBeGreaterThanOrEqual(3)
    const cooldownSteps = config.shooter.cannon.cooldownSeconds * 60
    for (let i = 1; i < shots.length; i += 1) {
      expect((shots[i] ?? 0) - (shots[i - 1] ?? 0)).toBeGreaterThanOrEqual(cooldownSteps)
    }
    expect(world.player.health).toBeLessThan(world.player.maxHealth)
  })

  it('never fires through an island', () => {
    const wall: ArenaDefinition = {
      ...openSea,
      islands: [{ x: 300, y: 0, width: 60, height: 720 }],
    }
    const session = sessionWith(wall, ({ world }) => [
      createShooterShip(world.nextId(), config.shooter, { x: 420, y: 360, angle: Math.PI }, 0),
    ])

    for (let step = 0; step < 60 * 10; step += 1) {
      session.step(IDLE_INPUT)
      expect(session.drainEvents().some((event) => event.type === 'shotFired')).toBe(false)
    }
    expect(session.world.player.health).toBe(session.world.player.maxHealth)
  })
})

describe('match end', () => {
  it('ends by death when the player is destroyed, counting the final step', () => {
    const session = sessionWith(openSea, ({ world }) =>
      [0, 1, 2, 3].map((index) =>
        createChaserShip(world.nextId(), config.chaser, { x: 600 + index * 60, y: 360, angle: Math.PI }),
      ),
    )
    runUntil(session, () => session.status.kind !== 'running')

    expect(session.status).toEqual({ kind: 'finished', reason: 'death' })
    expect(session.world.player.alive).toBe(false)
    expect(session.result?.endReason).toBe('death')
    expect(session.result?.activeDurationMs).toBe(Math.round((session.world.step * 1000) / 60))
  })
})
