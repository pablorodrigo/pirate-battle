import type { GameEvent } from '../core/events.ts'
import type { SessionStatus } from '../core/GameSession.ts'
import type { HudSnapshot } from '../runtime/GameRuntime.ts'
import type { SoundName, SoundPlayer } from './SoundBank.ts'

/** Relative volumes: the ambience stays under the cannons, enemy fire under the player's. */
const VOLUME: Readonly<Record<SoundName, number>> = {
  cannon: 0.6,
  broadside: 0.75,
  splash: 0.45,
  woodHit: 0.6,
  explosion: 0.8,
  collision: 0.7,
  sinking: 0.8,
  score: 0.45,
  healthLow: 0.7,
  timeWarning: 0.6,
  matchStart: 0.7,
  pause: 0.6,
  resume: 0.6,
  matchWon: 0.8,
  matchLost: 0.8,
  ocean: 0.3,
  sailing: 0.35,
}
const ENEMY_CANNON_VOLUME = 0.35
/** The last seconds of the clock tick audibly. */
const COUNTDOWN_SECONDS = 5

/**
 * Turns one match into sound: combat from the events of each frame, the
 * start, pauses, final countdown and low health from the HUD snapshot, and
 * the creak of the player's ship while it sails. Presentation only: it never
 * changes the match.
 */
export class MatchSounds {
  private readonly sounds: SoundPlayer
  private previous: HudSnapshot | null = null
  private sailing = false

  constructor(sounds: SoundPlayer) {
    this.sounds = sounds
  }

  /** Each sound plays at most once per frame, however many events ask for it. */
  handleEvents(events: readonly GameEvent[]): void {
    const frame = new Map<SoundName, number>()
    const queue = (name: SoundName, volume = VOLUME[name]) => {
      frame.set(name, Math.max(frame.get(name) ?? 0, volume))
    }
    for (const event of events) {
      switch (event.type) {
        case 'shotFired':
          if (event.cannon === 'front') {
            queue('cannon')
          } else if (event.cannon === 'enemy') {
            queue('cannon', ENEMY_CANNON_VOLUME)
          } else {
            queue('broadside')
          }
          break
        case 'projectileImpact':
          queue(event.target === 'ship' ? 'woodHit' : 'splash')
          break
        case 'shipDestroyed':
          queue('explosion')
          if (event.cause === 'collision') {
            queue('collision')
          }
          if (event.kind === 'player') {
            queue('sinking')
          }
          break
        case 'scoreChanged':
          queue('score')
          break
        case 'matchEnded':
          queue(event.reason === 'timeout' ? 'matchWon' : 'matchLost')
          break
        case 'shipDamaged':
        case 'enemySpawned':
          break
      }
    }
    for (const [name, volume] of frame) {
      this.sounds.play(name, volume)
    }
  }

  handleHud(hud: HudSnapshot): void {
    const previous = this.previous
    this.previous = hud
    if (previous?.status !== hud.status) {
      this.statusChanged(previous?.status ?? null, hud.status)
    }
    if (!previous || hud.status !== 'running') {
      return
    }
    const { remainingSeconds } = hud
    if (remainingSeconds !== previous.remainingSeconds && remainingSeconds > 0 && remainingSeconds <= COUNTDOWN_SECONDS) {
      this.play('timeWarning')
    }
    const lowHealth = hud.maxHealth / 3
    if (hud.health > 0 && hud.health <= lowHealth && previous.health > lowHealth) {
      this.play('healthLow')
    }
  }

  /** The sailing loop plays while the player's ship moves, and only while the match runs. */
  handleSailing(moving: boolean): void {
    const sailing = moving && this.previous?.status === 'running'
    if (sailing === this.sailing) {
      return
    }
    this.sailing = sailing
    if (sailing) {
      this.sounds.startLoop('sailing', VOLUME.sailing)
    } else {
      this.sounds.stopLoop('sailing')
    }
  }

  /** The match is over for this screen: silence its loops. */
  dispose(): void {
    this.sailing = false
    this.sounds.stopLoop()
  }

  private statusChanged(from: SessionStatus['kind'] | null, to: SessionStatus['kind']): void {
    if (to === 'running') {
      // Resuming happens inside the player's gesture, the moment browsers allow audio to resume.
      this.sounds.unlock()
      this.sounds.load()
      this.play(from === 'paused' ? 'resume' : 'matchStart')
      this.sounds.startLoop('ocean', VOLUME.ocean)
    } else if (to === 'paused') {
      this.play('pause')
      this.sailing = false
      this.sounds.stopLoop()
    } else if (to === 'finished' || to === 'abandoned') {
      this.sailing = false
      this.sounds.stopLoop()
    }
  }

  private play(name: SoundName): void {
    this.sounds.play(name, VOLUME[name])
  }
}
