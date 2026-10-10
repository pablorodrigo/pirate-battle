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
import shipSailing from '../../../assets/sounds/ship_sailing_loop.wav'
import shipSinking from '../../../assets/sounds/ship_sinking.wav'
import timeWarning from '../../../assets/sounds/time_warning.wav'
import woodHit1 from '../../../assets/sounds/ship_wood_hit_1.wav'
import woodHit2 from '../../../assets/sounds/ship_wood_hit_2.wav'
import uiBack from '../../../assets/sounds/ui_back.wav'
import uiClick from '../../../assets/sounds/ui_click.wav'
import uiClose from '../../../assets/sounds/ui_close.wav'
import uiOpen from '../../../assets/sounds/ui_open.wav'

/** Every sound of a match, with its variants: one is picked at random each time. */
const MATCH_SOUNDS = {
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
  sailing: [shipSailing],
} as const satisfies Record<string, readonly string[]>

/** The menus' sounds: a press, opening a screen, closing it and going back. */
const INTERFACE_SOUNDS = {
  click: [uiClick],
  open: [uiOpen],
  close: [uiClose],
  back: [uiBack],
} as const satisfies Record<string, readonly string[]>
const INTERFACE_VOLUME = 0.5

type SoundGroup = 'match' | 'interface'
const GROUP_FILES: Readonly<Record<SoundGroup, Readonly<Record<string, readonly string[]>>>> = {
  match: MATCH_SOUNDS,
  interface: INTERFACE_SOUNDS,
}
/** Loops fade in and out over this long, so they never start or stop with a click. */
const LOOP_FADE_SECONDS = 0.25

export type SoundName = keyof typeof MATCH_SOUNDS
export type InterfaceSoundName = keyof typeof INTERFACE_SOUNDS

/** What a match needs from the sound bank; tests replace it with a recorder. */
export type SoundPlayer = {
  /** Resumes audio if the browser suspended it; call it from user gestures. */
  unlock(): void
  /** Starts loading the match's sound files in the background, once. */
  load(): void
  play(name: SoundName, volume: number): void
  /** Starts a loop unless it already plays; several loops can play at once. */
  startLoop(name: SoundName, volume: number): void
  /** Fades out one loop, or every loop when no name is given. */
  stopLoop(name?: SoundName): void
}

type Playing = { readonly source: AudioBufferSourceNode; readonly gain: GainNode }
type Loop = { readonly volume: number; playing: Playing | null }

/**
 * Plays the provided sound effects through one Web Audio context shared by
 * every match, like the textures. Browsers only let audio start after a user
 * gesture, so the Play buttons call `unlock()`, and so does every press of a
 * menu button. Files load in the background in two groups, each once it is
 * first needed and only while sound is on: the menus' sounds at the first
 * press, the match's once a match has started. They never hold anything up:
 * a sound that is not ready, or failed to load, is skipped.
 */
export class SoundBank implements SoundPlayer {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private readonly buffers = new Map<string, AudioBuffer>()
  /** Groups asked for, and those already fetched: a group asked for while sound is off waits for it. */
  private readonly requested = new Set<SoundGroup>()
  private readonly fetched = new Set<SoundGroup>()
  private enabled = true
  private readonly loops = new Map<SoundName, Loop>()

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.master) {
      this.master.gain.value = enabled ? 1 : 0
    }
    // Turning sound on loads the groups skipped so far.
    this.fetchRequested()
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
        () => this.startWantedLoops(),
        () => undefined,
      )
    }
  }

  load(): void {
    this.request('match')
  }

  /** Plays a menu sound inside the gesture that asked for it; the first press loads them. */
  playInterface(name: InterfaceSoundName): void {
    this.unlock()
    this.request('interface')
    const buffer = this.bufferFor(INTERFACE_SOUNDS[name])
    if (buffer && this.enabled) {
      this.start(buffer, INTERFACE_VOLUME, false)
    }
  }

  play(name: SoundName, volume: number): void {
    const buffer = this.bufferFor(MATCH_SOUNDS[name])
    if (buffer && this.enabled) {
      this.start(buffer, volume, false)
    }
  }

  startLoop(name: SoundName, volume: number): void {
    if (!this.loops.has(name)) {
      this.loops.set(name, { volume, playing: null })
      this.startWantedLoops()
    }
  }

  stopLoop(name?: SoundName): void {
    for (const [loopName, loop] of this.loops) {
      if (name === undefined || loopName === name) {
        this.fadeOut(loop)
        this.loops.delete(loopName)
      }
    }
  }

  private request(group: SoundGroup): void {
    this.requested.add(group)
    this.fetchRequested()
  }

  private fetchRequested(): void {
    const { context } = this
    if (!context || !this.enabled) {
      return
    }
    for (const group of this.requested) {
      if (this.fetched.has(group)) {
        continue
      }
      this.fetched.add(group)
      for (const url of new Set(Object.values(GROUP_FILES[group]).flat())) {
        void this.decode(context, url)
      }
    }
  }

  private async decode(context: AudioContext, url: string): Promise<void> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        return
      }
      this.buffers.set(url, await context.decodeAudioData(await response.arrayBuffer()))
      // A loop may have been asked for before its file arrived.
      this.startWantedLoops()
    } catch {
      // A missing sound only means silence; the game never depends on audio.
    }
  }

  /** Starts each wanted loop once its file and the audio context are both ready. */
  private startWantedLoops(): void {
    for (const [name, loop] of this.loops) {
      const buffer = loop.playing ? undefined : this.bufferFor(MATCH_SOUNDS[name])
      if (buffer) {
        loop.playing = this.start(buffer, loop.volume, true)
      }
    }
  }

  private fadeOut(loop: Loop): void {
    const { context } = this
    if (!context || !loop.playing) {
      return
    }
    const { source, gain } = loop.playing
    const now = context.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + LOOP_FADE_SECONDS)
    source.stop(now + LOOP_FADE_SECONDS)
  }

  private bufferFor(variants: readonly string[]): AudioBuffer | undefined {
    const url = variants[Math.floor(Math.random() * variants.length)]
    return url === undefined ? undefined : this.buffers.get(url)
  }

  /** A loop fades in; a single sound starts at its volume. */
  private start(buffer: AudioBuffer, volume: number, loop: boolean): Playing | null {
    const { context, master } = this
    if (!context || !master || context.state !== 'running') {
      return null
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = loop
    const gain = context.createGain()
    if (loop) {
      gain.gain.setValueAtTime(0, context.currentTime)
      gain.gain.linearRampToValueAtTime(volume, context.currentTime + LOOP_FADE_SECONDS)
    } else {
      gain.gain.value = volume
    }
    source.connect(gain).connect(master)
    source.start()
    return { source, gain }
  }
}

/** The one sound bank of the page. */
export const soundBank = new SoundBank()
