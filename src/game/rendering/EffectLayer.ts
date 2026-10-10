import { Container, Graphics, GraphicsContext, Sprite, type Texture } from 'pixi.js'
import type { GameTextures } from '../assets/gameTextures.ts'
import type { GameEvent } from '../core/events.ts'
import { deriveSeed, SeededRandom } from '../core/math/random.ts'

/** Radius the shared ring is tessellated at; rings scale relative to it. */
const RING_RADIUS = 32

type Animation = {
  readonly durationSteps: number
  readonly fromScale: number
  readonly toScale: number
  readonly fromAlpha: number
  /** Share of the animation shown at full opacity before it fades out; half by default. */
  readonly fadeFrom?: number
}

const MUZZLE_FLASH: Animation = { durationSteps: 6, fromScale: 0.32, toScale: 0.12, fromAlpha: 1 }
const HIT: Animation = { durationSteps: 12, fromScale: 0.3, toScale: 0.55, fromAlpha: 1 }
const EXPLOSION: Animation = { durationSteps: 28, fromScale: 0.35, toScale: 1.1, fromAlpha: 1 }
const SPLASH: Animation = { durationSteps: 16, fromScale: 4 / RING_RADIUS, toScale: 15 / RING_RADIUS, fromAlpha: 0.9 }
const SINKING_STEPS = 70
/** A sailor's leap overboard, seen whole until they dive in, and the small splash where they land. */
const CREW_LEAP: Animation = { durationSteps: 34, fromScale: 0.85, toScale: 0.7, fromAlpha: 1, fadeFrom: 0.85 }
const CREW_SPLASH: Animation = { durationSteps: 14, fromScale: 3 / RING_RADIUS, toScale: 10 / RING_RADIUS, fromAlpha: 0.8 }
/** How the leap reads from above: the sailor grows towards its top, half way, and shrinks back down. */
const CREW_HOP = 0.5
const CREW = { min: 2, max: 3, distance: { min: 36, max: 58 }, spread: 0.7, spin: 5 } as const
/** Keeps the crew's draws apart from any other stream seeded by ship ids. */
const CREW_SALT = 0x63726577

/** Travel from one point to another, eased out, while turning. */
type Motion = {
  readonly fromX: number
  readonly fromY: number
  readonly toX: number
  readonly toY: number
  readonly spin: number
  readonly hop: number
}

type ActiveEffect = {
  readonly display: Sprite | Graphics
  readonly animation: Animation
  readonly startStep: number
  readonly motion?: Motion
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
        this.spawnCrew(event.shipId, event.x, event.y, event.angle, now)
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
      // An effect scheduled for later stays hidden until its start.
      effect.display.visible = progress >= 0
      if (progress < 0) {
        continue
      }
      let scale = fromScale + (toScale - fromScale) * progress
      const { motion } = effect
      if (motion) {
        const eased = 1 - (1 - progress) * (1 - progress)
        effect.display.position.set(
          motion.fromX + (motion.toX - motion.fromX) * eased,
          motion.fromY + (motion.toY - motion.fromY) * eased,
        )
        effect.display.rotation = motion.spin * eased
        scale *= 1 + motion.hop * Math.sin(Math.PI * progress)
      }
      effect.display.scale.set(scale)
      // Hold full opacity, for the first half unless the animation says otherwise, then fade out.
      const fadeFrom = effect.animation.fadeFrom ?? 0.5
      effect.display.alpha = fromAlpha * Math.min(1, (1 - progress) / (1 - fadeFrom))
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

  private spawnRing(x: number, y: number, now: number, animation = SPLASH): void {
    const ring = new Graphics(this.ring)
    ring.position.set(x, y)
    ring.tint = 0xe8f6ff
    ring.scale.set(animation.fromScale)
    this.add(ring, animation, now)
  }

  /**
   * Two or three sailors leap off the sides of a destroyed ship, spinning, and
   * splash into the water. The ship's id seeds their leaps, so the same match
   * always shows the same ones.
   */
  private spawnCrew(shipId: number, x: number, y: number, angle: number, now: number): void {
    const random = new SeededRandom(deriveSeed(shipId, CREW_SALT))
    const count = random.integer(CREW.min, CREW.max)
    for (let index = 0; index < count; index += 1) {
      const texture = this.textures.crew[random.integer(0, this.textures.crew.length - 1)]
      if (!texture) {
        continue
      }
      // Alternate sides, off the beam, from a spot along the hull.
      const side = index % 2 === 0 ? 1 : -1
      const along = random.range(-10, 10)
      const fromX = x + Math.cos(angle) * along
      const fromY = y + Math.sin(angle) * along
      const direction = angle + side * (Math.PI / 2 + random.range(-CREW.spread, CREW.spread))
      const distance = random.range(CREW.distance.min, CREW.distance.max)
      const toX = fromX + Math.cos(direction) * distance
      const toY = fromY + Math.sin(direction) * distance
      const spin = random.range(-CREW.spin, CREW.spin)
      const sailor = new Sprite({ texture, anchor: 0.5, x: fromX, y: fromY })
      sailor.scale.set(CREW_LEAP.fromScale)
      this.add(sailor, CREW_LEAP, now, { fromX, fromY, toX, toY, spin, hop: CREW_HOP })
      this.spawnRing(toX, toY, now + CREW_LEAP.durationSteps * (CREW_LEAP.fadeFrom ?? 0.5), CREW_SPLASH)
    }
  }

  /** `start` may lie ahead of the current step, for an effect that follows another. */
  private add(display: Sprite | Graphics, animation: Animation, start: number, motion?: Motion): void {
    display.alpha = animation.fromAlpha
    display.visible = false
    this.root.addChild(display)
    this.effects.push(motion ? { display, animation, startStep: start, motion } : { display, animation, startStep: start })
  }
}
