import { describe, expect, it } from 'vitest'
import type { GameplayConfig } from '../config/GameplayConfig.ts'
import { defaultArena } from '../config/defaultArena.ts'
import { defaultGameplayConfig } from '../config/defaultConfig.ts'
import { GameSession } from './GameSession.ts'
import { IDLE_INPUT, type InputSnapshot } from './input.ts'

// No enemy spawns during these one-minute matches.
const config: GameplayConfig = {
  ...defaultGameplayConfig,
  matchDurationSeconds: 60,
  spawn: { ...defaultGameplayConfig.spawn, intervalSeconds: 1000 },
}
const thrust: InputSnapshot = { ...IDLE_INPUT, thrust: true }

function runSteps(session: GameSession, count: number, input: InputSnapshot = IDLE_INPUT): void {
  for (let i = 0; i < count; i += 1) {
    session.step(input)
  }
}

describe('GameSession', () => {
  it('does not advance before it starts', () => {
    const session = new GameSession(config, defaultArena, 1)
    runSteps(session, 10, thrust)
    expect(session.world.step).toBe(0)
    expect(session.world.player.x).toBe(defaultArena.playerStart.x)
  })

  it('freezes time and movement while paused', () => {
    const session = new GameSession(config, defaultArena, 1)
    session.start()
    runSteps(session, 30, thrust)
    const position = session.world.player.x

    session.pause('manual')
    runSteps(session, 600, thrust)
    expect(session.world.step).toBe(30)
    expect(session.world.player.x).toBe(position)

    session.resume()
    session.step(thrust)
    expect(session.world.step).toBe(31)
  })

  it('ends by timeout after the configured active time and then ignores input', () => {
    const session = new GameSession(config, defaultArena, 1)
    session.start()
    runSteps(session, session.durationSteps - 1)
    expect(session.status.kind).toBe('running')

    session.step(IDLE_INPUT)
    expect(session.status).toEqual({ kind: 'finished', reason: 'timeout' })
    expect(session.result).toEqual({ score: 0, activeDurationMs: 60_000, endReason: 'timeout' })
    expect(session.drainEvents()).toContainEqual({ type: 'matchEnded', reason: 'timeout' })

    const position = session.world.player.x
    runSteps(session, 60, thrust)
    expect(session.world.step).toBe(session.durationSteps)
    expect(session.world.player.x).toBe(position)
  })

  it('records no result when abandoned', () => {
    const session = new GameSession(config, defaultArena, 1)
    session.start()
    runSteps(session, 10)
    session.abandon()
    expect(session.status.kind).toBe('abandoned')
    expect(session.result).toBeNull()
  })
})
