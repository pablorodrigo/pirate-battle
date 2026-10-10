import { Container, Graphics, GraphicsContext } from 'pixi.js'
import type { GameEvent } from '../core/events.ts'

/** Radius the shared shapes are tessellated at; effects scale relative to it. */
const BASE_RADIUS = 32

type EffectStyle = {
  readonly shape: 'disc' | 'ring'
  readonly color: number
  readonly durationSteps: number
  readonly fromRadius: number
  readonly toRadius: number
  readonly fromAlpha: number
}

const STYLES = {
  muzzleFlash: { shape: 'disc', color: 0xffd36b, durationSteps: 6, fromRadius: 9, toRadius: 3, fromAlpha: 0.95 },
  splash: { shape: 'ring', color: 0xe8f6ff, durationSteps: 14, fromRadius: 4, toRadius: 14, fromAlpha: 0.9 },
  hit: { shape: 'disc', color: 0xff8a3d, durationSteps: 10, fromRadius: 10, toRadius: 4, fromAlpha: 1 },
  explosion: { shape: 'disc', color: 0xff6a2b, durationSteps: 30, fromRadius: 14, toRadius: 54, fromAlpha: 0.95 },
  shockwave: { shape: 'ring', color: 0xffd36b, durationSteps: 24, fromRadius: 10, toRadius: 70, fromAlpha: 0.8 },
} as const satisfies Record<string, EffectStyle>

type ActiveEffect = {
  readonly graphic: Graphics
  readonly style: EffectStyle
  readonly startStep: number
}

/**
 * Short visual effects driven by simulation time: they freeze while the match
 * is paused and look the same for the same match, which keeps screenshots
 * reproducible. Effects only react to events; they never decide outcomes.
 */
export class EffectLayer {
  readonly root = new Container()
  private readonly effects: ActiveEffect[] = []
  // Shared geometry, owned here and destroyed after every effect using it.
  private readonly disc = new GraphicsContext().circle(0, 0, BASE_RADIUS).fill(0xffffff)
  private readonly ring = new GraphicsContext().circle(0, 0, BASE_RADIUS).stroke({ width: 4, color: 0xffffff })

  handle(event: GameEvent, now: number): void {
    switch (event.type) {
      case 'shotFired':
        this.spawn(STYLES.muzzleFlash, event.x, event.y, now)
        break
      case 'projectileImpact':
        this.spawn(event.target === 'ship' ? STYLES.hit : STYLES.splash, event.x, event.y, now)
        break
      case 'shipDestroyed':
        this.spawn(STYLES.explosion, event.x, event.y, now)
        this.spawn(STYLES.shockwave, event.x, event.y, now)
        break
      default:
        break
    }
  }

  update(now: number): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index]
      if (!effect) {
        continue
      }
      const progress = (now - effect.startStep) / effect.style.durationSteps
      if (progress >= 1) {
        effect.graphic.destroy()
        this.effects.splice(index, 1)
        continue
      }
      const { fromRadius, toRadius, fromAlpha } = effect.style
      effect.graphic.scale.set((fromRadius + (toRadius - fromRadius) * progress) / BASE_RADIUS)
      effect.graphic.alpha = fromAlpha * (1 - progress)
    }
  }

  get count(): number {
    return this.effects.length
  }

  destroy(): void {
    for (const effect of this.effects) {
      effect.graphic.destroy()
    }
    this.effects.length = 0
    this.disc.destroy()
    this.ring.destroy()
    this.root.destroy()
  }

  private spawn(style: EffectStyle, x: number, y: number, now: number): void {
    const graphic = new Graphics(style.shape === 'disc' ? this.disc : this.ring)
    graphic.tint = style.color
    graphic.position.set(x, y)
    graphic.scale.set(style.fromRadius / BASE_RADIUS)
    graphic.alpha = style.fromAlpha
    this.root.addChild(graphic)
    this.effects.push({ graphic, style, startStep: now })
  }
}
