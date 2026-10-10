import { Container, Graphics, GraphicsContext, Sprite, type Texture } from 'pixi.js'
import type { GameTextures } from '../assets/gameTextures.ts'
import type { GameEvent } from '../core/events.ts'

/** Radius the shared ring is tessellated at; rings scale relative to it. */
const RING_RADIUS = 32

type Animation = {
  readonly durationSteps: number
  readonly fromScale: number
  readonly toScale: number
  readonly fromAlpha: number
}

const MUZZLE_FLASH: Animation = { durationSteps: 6, fromScale: 0.32, toScale: 0.12, fromAlpha: 1 }
const HIT: Animation = { durationSteps: 12, fromScale: 0.3, toScale: 0.55, fromAlpha: 1 }
const EXPLOSION: Animation = { durationSteps: 28, fromScale: 0.35, toScale: 1.1, fromAlpha: 1 }
const SPLASH: Animation = { durationSteps: 16, fromScale: 4 / RING_RADIUS, toScale: 15 / RING_RADIUS, fromAlpha: 0.9 }
const SINKING_STEPS = 70

type ActiveEffect = {
  readonly display: Sprite | Graphics
  readonly animation: Animation
  readonly startStep: number
}

/**
 * Short effects driven by simulation time: they freeze while the match is
 * paused and look the same for the same match, which keeps screenshots
 * reproducible. Effects only react to events; they never decide outcomes.
 */
export class EffectLayer {
  readonly root = new Container()
  private readonly textures: GameTextures
  private readonly effects: ActiveEffect[] = []
  // Shared geometry owned here and destroyed after every effect that uses it.
  private readonly ring = new GraphicsContext().circle(0, 0, RING_RADIUS).stroke({ width: 5, color: 0xffffff })

  constructor(textures: GameTextures) {
    this.textures = textures
  }

  get count(): number {
    return this.effects.length
  }

  handle(event: GameEvent, now: number): void {
    const [largeExplosion, , smallExplosion] = this.textures.explosions
    switch (event.type) {
      case 'shotFired':
        this.spawnSprite(smallExplosion, event.x, event.y, MUZZLE_FLASH, now)
        break
      case 'projectileImpact':
        if (event.target === 'ship') {
          this.spawnSprite(smallExplosion, event.x, event.y, HIT, now)
        } else {
          this.spawnRing(event.x, event.y, now)
        }
        break
      case 'shipDestroyed':
        this.spawnSprite(largeExplosion, event.x, event.y, EXPLOSION, now)
        break
      default:
        break
    }
  }

  /** Leaves the wreck of a destroyed ship sinking where it went down, under its explosion. */
  sinkWreck(texture: Texture, x: number, y: number, rotation: number, scale: number, now: number): void {
    const animation = { durationSteps: SINKING_STEPS, fromScale: scale, toScale: scale * 0.75, fromAlpha: 1 }
    const sprite = new Sprite({ texture, anchor: 0.5, x, y, rotation })
    sprite.scale.set(scale)
    this.add(sprite, animation, now)
    this.root.setChildIndex(sprite, 0)
  }

  update(now: number): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index]
      if (!effect) {
        continue
      }
      const { durationSteps, fromScale, toScale, fromAlpha } = effect.animation
      const progress = (now - effect.startStep) / durationSteps
      if (progress >= 1) {
        effect.display.destroy()
        this.effects.splice(index, 1)
        continue
      }
      effect.display.scale.set(fromScale + (toScale - fromScale) * progress)
      // Hold full opacity for the first half, then fade out.
      effect.display.alpha = fromAlpha * Math.min(1, 2 * (1 - progress))
    }
  }

  /** Sprites and Graphics are destroyed without options, so shared textures and contexts stay intact. */
  destroy(): void {
    for (const effect of this.effects) {
      effect.display.destroy()
    }
    this.effects.length = 0
    this.ring.destroy()
    this.root.destroy()
  }

  private spawnSprite(
    texture: Texture,
    x: number,
    y: number,
    animation: Animation,
    now: number,
    rotation = 0,
  ): void {
    const sprite = new Sprite({ texture, anchor: 0.5, x, y, rotation })
    sprite.scale.set(animation.fromScale)
    this.add(sprite, animation, now)
  }

  private spawnRing(x: number, y: number, now: number): void {
    const ring = new Graphics(this.ring)
    ring.position.set(x, y)
    ring.tint = 0xe8f6ff
    ring.scale.set(SPLASH.fromScale)
    this.add(ring, SPLASH, now)
  }

  private add(display: Sprite | Graphics, animation: Animation, now: number): void {
    display.alpha = animation.fromAlpha
    this.root.addChild(display)
    this.effects.push({ display, animation, startStep: now })
  }
}
