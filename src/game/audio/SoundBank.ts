import cannonBroadside from '../../../assets/sounds/cannon_broadside.wav'
import cannonFire1 from '../../../assets/sounds/cannon_fire_1.wav'
import cannonFire2 from '../../../assets/sounds/cannon_fire_2.wav'
import cannonFire3 from '../../../assets/sounds/cannon_fire_3.wav'
import waterHit1 from '../../../assets/sounds/cannonball_water_hit_1.wav'
import waterHit2 from '../../../assets/sounds/cannonball_water_hit_2.wav'
import gameComplete from '../../../assets/sounds/game_complete.wav'
import gameOver from '../../../assets/sounds/game_over.wav'
import gamePause from '../../../assets/sounds/game_pause.wav'
import gameResume from '../../../assets/sounds/game_resume.wav'
import gameStart from '../../../assets/sounds/game_start.wav'
import healthLow from '../../../assets/sounds/health_low.wav'
import oceanAmbience from '../../../assets/sounds/ocean_ambience_loop.wav'
import scorePoint from '../../../assets/sounds/score_point.wav'
import shipCollision from '../../../assets/sounds/ship_collision.wav'
import shipExplosion1 from '../../../assets/sounds/ship_explosion_1.wav'
import shipExplosion2 from '../../../assets/sounds/ship_explosion_2.wav'
import shipSinking from '../../../assets/sounds/ship_sinking.wav'
import timeWarning from '../../../assets/sounds/time_warning.wav'
import woodHit1 from '../../../assets/sounds/ship_wood_hit_1.wav'
import woodHit2 from '../../../assets/sounds/ship_wood_hit_2.wav'

/** Every sound the game plays, with its variants: one is picked at random each time. */
const SOUND_FILES = {
  cannon: [cannonFire1, cannonFire2, cannonFire3],
  broadside: [cannonBroadside],
  splash: [waterHit1, waterHit2],
  woodHit: [woodHit1, woodHit2],
  explosion: [shipExplosion1, shipExplosion2],
  collision: [shipCollision],
  sinking: [shipSinking],
  score: [scorePoint],
  healthLow: [healthLow],
  timeWarning: [timeWarning],
  matchStart: [gameStart],
  pause: [gamePause],
  resume: [gameResume],
  matchWon: [gameComplete],
  matchLost: [gameOver],
  ocean: [oceanAmbience],
} as const satisfies Record<string, readonly string[]>

export type SoundName = keyof typeof SOUND_FILES

/** What a match needs from the sound bank; tests replace it with a recorder. */
export type SoundPlayer = {
  /** Resumes audio if the browser suspended it; call it from user gestures. */
  unlock(): void
  /** Starts loading the sound files in the background, once. */
  load(): void
  play(name: SoundName, volume: number): void
  startLoop(name: SoundName, volume: number): void
  stopLoop(): void
}

type Loop = { readonly name: SoundName; readonly volume: number }

/**
 * Plays the provided sound effects through one Web Audio context shared by
 * every match, like the textures. Browsers only let audio start after a user
 * gesture, so the Play buttons call `unlock()`. Files load in the background
 * once a match has started, and only while sound is on; they never hold a
 * match up: a sound that is not ready, or failed to load, is skipped.
 */
export class SoundBank implements SoundPlayer {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private readonly buffers = new Map<string, AudioBuffer>()
  private loading = false
  private enabled = true
  private wantedLoop: Loop | null = null
  private playingLoop: AudioBufferSourceNode | null = null

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.master) {
      this.master.gain.value = enabled ? 1 : 0
    }
    // Turning sound on after a match has started loads the files skipped so far.
    this.load()
  }

  unlock(): void {
    if (!this.context) {
      if (typeof AudioContext === 'undefined') {
        return
      }
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = this.enabled ? 1 : 0
      this.master.connect(this.context.destination)
    }
    if (this.context.state !== 'running') {
      // Resuming is asynchronous; a refused resume only means silence until the next gesture.
      this.context.resume().then(
        () => this.startWantedLoop(),
        () => undefined,
      )
    }
  }

  load(): void {
    const { context } = this
    if (!context || this.loading || !this.enabled) {
      return
    }
    this.loading = true
    const urls = new Set<string>(Object.values(SOUND_FILES).flat())
    for (const url of urls) {
      void this.decode(context, url)
    }
  }

  play(name: SoundName, volume: number): void {
    const buffer = this.bufferFor(name)
    if (buffer && this.enabled) {
      this.start(buffer, volume, false)
    }
  }

  startLoop(name: SoundName, volume: number): void {
    this.stopLoop()
    this.wantedLoop = { name, volume }
    this.startWantedLoop()
  }

  stopLoop(): void {
    this.wantedLoop = null
    this.playingLoop?.stop()
    this.playingLoop = null
  }

  private async decode(context: AudioContext, url: string): Promise<void> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        return
      }
      this.buffers.set(url, await context.decodeAudioData(await response.arrayBuffer()))
      // The ambience may have been asked for before its file arrived.
      this.startWantedLoop()
    } catch {
      // A missing sound only means silence; the game never depends on audio.
    }
  }

  /** Starts the wanted ambience once its file and the audio context are both ready. */
  private startWantedLoop(): void {
    const loop = this.wantedLoop
    const buffer = loop && !this.playingLoop ? this.bufferFor(loop.name) : undefined
    if (loop && buffer) {
      this.playingLoop = this.start(buffer, loop.volume, true)
    }
  }

  private bufferFor(name: SoundName): AudioBuffer | undefined {
    const variants: readonly string[] = SOUND_FILES[name]
    const url = variants[Math.floor(Math.random() * variants.length)]
    return url === undefined ? undefined : this.buffers.get(url)
  }

  private start(buffer: AudioBuffer, volume: number, loop: boolean): AudioBufferSourceNode | null {
    const { context, master } = this
    if (!context || !master || context.state !== 'running') {
      return null
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = loop
    const gain = context.createGain()
    gain.gain.value = volume
    source.connect(gain).connect(master)
    source.start()
    return source
  }
}

/** The one sound bank of the page. */
export const soundBank = new SoundBank()
