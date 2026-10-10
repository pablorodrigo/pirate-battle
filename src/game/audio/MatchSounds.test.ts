import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../core/events.ts'
import type { HudSnapshot } from '../runtime/GameRuntime.ts'
import { MatchSounds } from './MatchSounds.ts'
import type { SoundPlayer } from './SoundBank.ts'

function recorder() {
  const calls: string[] = []
  const player: SoundPlayer = {
    unlock: () => calls.push('unlock'),
    load: () => calls.push('load'),
    play: (name, volume) => calls.push(`play ${name} ${volume}`),
    startLoop: (name) => calls.push(`loop ${name}`),
    stopLoop: () => calls.push('stop loop'),
  }
  return { sounds: new MatchSounds(player), calls }
}

const READY: HudSnapshot = {
  status: 'ready',
  pauseReason: null,
  endReason: null,
  score: 0,
  health: 100,
  maxHealth: 100,
  remainingSeconds: 120,
}

const shot = (cannon: 'front' | 'left' | 'right' | 'enemy', shipId = 1): GameEvent => ({
  type: 'shotFired',
  shipId,
  cannon,
  x: 0,
  y: 0,
  angle: 0,
})

describe('MatchSounds', () => {
  it('plays each sound once per frame, however many events ask for it', () => {
    const { sounds, calls } = recorder()
    sounds.handleEvents([
      shot('left'),
      shot('left'),
      shot('left'),
      shot('front'),
      shot('enemy', 7),
      { type: 'projectileImpact', x: 0, y: 0, target: 'ship' },
      { type: 'projectileImpact', x: 5, y: 5, target: 'ship' },
      { type: 'projectileImpact', x: 9, y: 9, target: 'island' },
    ])
    expect(calls).toEqual(['play broadside 0.75', 'play cannon 0.6', 'play woodHit 0.6', 'play splash 0.45'])
  })

  it('plays enemy fire quieter than the player cannons', () => {
    const { sounds, calls } = recorder()
    sounds.handleEvents([shot('enemy', 7)])
    expect(calls).toEqual(['play cannon 0.35'])
  })

  it('explodes destroyed ships, crashes on rams and sinks the player', () => {
    const { sounds, calls } = recorder()
    sounds.handleEvents([
      { type: 'shipDestroyed', shipId: 4, kind: 'chaser', cause: 'collision', x: 0, y: 0, angle: 0 },
      { type: 'scoreChanged', score: 1 },
    ])
    sounds.handleEvents([{ type: 'shipDestroyed', shipId: 1, kind: 'player', cause: 'projectile', x: 0, y: 0, angle: 0 }])
    expect(calls).toEqual([
      'play explosion 0.8',
      'play collision 0.7',
      'play score 0.45',
      'play explosion 0.8',
      'play sinking 0.8',
    ])
  })

  it('ends the match with a sound for each outcome', () => {
    const { sounds, calls } = recorder()
    sounds.handleEvents([{ type: 'matchEnded', reason: 'timeout' }])
    sounds.handleEvents([{ type: 'matchEnded', reason: 'death' }])
    expect(calls).toEqual(['play matchWon 0.8', 'play matchLost 0.8'])
  })

  it('starts the ambience with the match, silences it while paused and resumes it', () => {
    const { sounds, calls } = recorder()
    sounds.handleHud(READY)
    sounds.handleHud({ ...READY, status: 'running' })
    sounds.handleHud({ ...READY, status: 'paused', pauseReason: 'manual' })
    sounds.handleHud({ ...READY, status: 'running' })
    sounds.handleHud({ ...READY, status: 'finished', endReason: 'timeout' })
    expect(calls).toEqual([
      'unlock',
      'load',
      'play matchStart 0.7',
      'loop ocean',
      'play pause 0.6',
      'stop loop',
      'unlock',
      'load',
      'play resume 0.6',
      'loop ocean',
      'stop loop',
    ])
  })

  it('ticks once a second during the last five seconds', () => {
    const { sounds, calls } = recorder()
    for (const remainingSeconds of [8, 7, 6, 5, 4, 3, 2, 1, 0]) {
      sounds.handleHud({ ...READY, status: 'running', remainingSeconds })
    }
    expect(calls.filter((call) => call.startsWith('play timeWarning'))).toHaveLength(5)
  })

  it('warns once when health falls below a third', () => {
    const { sounds, calls } = recorder()
    for (const health of [100, 50, 40, 30, 20, 10]) {
      sounds.handleHud({ ...READY, status: 'running', health })
    }
    expect(calls.filter((call) => call.startsWith('play healthLow'))).toEqual(['play healthLow 0.7'])
  })

  it('stops the ambience when the screen releases the match', () => {
    const { sounds, calls } = recorder()
    sounds.dispose()
    expect(calls).toEqual(['stop loop'])
  })
})
