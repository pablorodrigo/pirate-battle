import { describe, expect, it } from 'vitest'
import { defaultArena } from '../../config/defaultArena.ts'
import { createMatchConfig } from '../../config/matchSettings.ts'
import { GameSession } from '../GameSession.ts'
import { IDLE_INPUT } from '../input.ts'
import { resolveCircleRect } from '../math/geometry.ts'

const config = createMatchConfig({ matchDurationSeconds: 60, spawnIntervalSeconds: 2.5 })
const intervalSteps = 150

function spawnsOf(session: GameSession) {
  return session.drainEvents().filter((event) => event.type === 'enemySpawned')
}

describe('Spawner', () => {
  it('opens with a Chaser and then a Shooter, one per interval of active play', () => {
    const session = new GameSession(config, defaultArena, 11)
    session.start()

    for (let i = 0; i < intervalSteps - 1; i += 1) {
      session.step(IDLE_INPUT)
    }
    expect(spawnsOf(session)).toHaveLength(0)
    session.step(IDLE_INPUT)
    expect(spawnsOf(session)).toEqual([expect.objectContaining({ kind: 'chaser' })])

    for (let i = 0; i < intervalSteps; i += 1) {
      session.step(IDLE_INPUT)
    }
    expect(spawnsOf(session)).toEqual([expect.objectContaining({ kind: 'shooter' })])
  })

  it('places enemies on open water, far from the player', () => {
    const session = new GameSession(config, defaultArena, 23)
    session.start()
    const { world } = session
    for (let i = 0; i < intervalSteps * 2; i += 1) {
      session.step(IDLE_INPUT)
      for (const event of session.drainEvents()) {
        if (event.type !== 'enemySpawned') {
          continue
        }
        const enemy = world.enemies.find((ship) => ship.id === event.shipId)
        expect(enemy).toBeDefined()
        if (!enemy) {
          continue
        }
        const distance = Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y)
        expect(distance).toBeGreaterThanOrEqual(config.spawn.minDistanceFromPlayer)
        for (const island of defaultArena.islands) {
          expect(resolveCircleRect(enemy.x, enemy.y, enemy.radius, island)).toBeNull()
        }
      }
    }
  })

  it('does not spawn while paused', () => {
    const session = new GameSession(config, defaultArena, 5)
    session.start()
    session.pause('manual')
    for (let i = 0; i < intervalSteps * 3; i += 1) {
      session.step(IDLE_INPUT)
    }
    expect(session.world.enemies).toHaveLength(0)
  })

  it('reproduces the same spawns from the same seed', () => {
    const positions = (seed: number) => {
      const session = new GameSession(config, defaultArena, seed)
      session.start()
      for (let i = 0; i < intervalSteps * 4; i += 1) {
        session.step(IDLE_INPUT)
      }
      return session.world.enemies.map((enemy) => [enemy.kind, Math.round(enemy.x), Math.round(enemy.y)])
    }

    expect(positions(99)).toEqual(positions(99))
    expect(positions(99)).not.toEqual(positions(100))
  })
})
