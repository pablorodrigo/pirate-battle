import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import type { DamageStage, GameTextures } from '../assets/gameTextures.ts'
import type { Ship } from '../core/entities.ts'
import { angleDifference } from '../core/math/geometry.ts'

/** Ship sprites have the bow at the bottom; a ship angle of 0 points along +x. */
export const SHIP_SPRITE_ROTATION = -Math.PI / 2
/** Hull sprite width relative to the collider radius, so the art matches the rules' geometry. */
const HULL_WIDTH_PER_RADIUS = 2.1
const OUTLINE_COLOR = 0x0b2a3c
const HEALTH_COLORS = { high: 0x4caf50, medium: 0xf2b33d, low: 0xe5533d } as const
const HIT_TINT = 0xff8f8f
const HIT_FLASH_STEPS = 8
const HEALTH_BAR_HEIGHT = 5
const HEALTH_BAR_GAP = 18

export function hullScale(ship: Pick<Ship, 'radius'>, texture: Texture): number {
  return (ship.radius * HULL_WIDTH_PER_RADIUS) / texture.width
}

/** The visual stage follows the remaining health; it never changes the damage rules. */
export function damageStageOf(health: number, maxHealth: number): Exclude<DamageStage, 'wreck'> {
  const ratio = health / maxHealth
  return ratio > 2 / 3 ? 'intact' : ratio > 1 / 3 ? 'damaged' : 'critical'
}

/**
 * Sprite view of a ship: the hull shows tattered sails as it loses health,
 * burns when critical and flashes when hit, with a level health bar above it.
 * It only reads the ship; it never changes game state.
 */
export class ShipView {
  readonly root = new Container()
  private readonly hull: Sprite
  private readonly flame: Sprite
  private readonly healthFill = new Graphics()
  private readonly stages: Readonly<Record<DamageStage, Texture>>
  private readonly flames: readonly Texture[]
  private stage: DamageStage = 'intact'
  private lastHitStep = Number.NEGATIVE_INFINITY

  constructor(ship: Ship, textures: GameTextures) {
    this.stages = textures.ships[ship.kind]
    this.flames = textures.flames
    this.hull = new Sprite({ texture: this.stages.intact, anchor: 0.5 })
    this.hull.scale.set(hullScale(ship, this.stages.intact))
    this.flame = new Sprite({ texture: textures.flames[0], anchor: { x: 0.5, y: 0.85 } })
    this.flame.visible = false

    const barWidth = ship.radius * 2
    const barY = -ship.radius - HEALTH_BAR_GAP
    const healthBackground = new Graphics()
      .roundRect(-barWidth / 2 - 1.5, barY - 1.5, barWidth + 3, HEALTH_BAR_HEIGHT + 3, 3)
      .fill(OUTLINE_COLOR)
    this.healthFill.roundRect(0, 0, barWidth, HEALTH_BAR_HEIGHT, 2).fill(0xffffff)
    this.healthFill.position.set(-barWidth / 2, barY)

    this.root.addChild(this.hull, this.flame, healthBackground, this.healthFill)
  }

  flash(now: number): void {
    this.lastHitStep = now
  }

  /** Where and how the hull is drawn, so its wreck can sink in the same pose. */
  get hullPose(): { readonly x: number; readonly y: number; readonly rotation: number; readonly scale: number } {
    return { x: this.root.x, y: this.root.y, rotation: this.hull.rotation, scale: this.hull.scale.x }
  }

  /** Draws the ship between its last two simulated poses. */
  update(ship: Ship, alpha: number, now: number): void {
    this.root.position.set(
      ship.previousX + (ship.x - ship.previousX) * alpha,
      ship.previousY + (ship.y - ship.previousY) * alpha,
    )
    const angle = ship.previousAngle + angleDifference(ship.previousAngle, ship.angle) * alpha
    this.hull.rotation = angle + SHIP_SPRITE_ROTATION

    const stage = damageStageOf(ship.health, ship.maxHealth)
    if (stage !== this.stage) {
      this.stage = stage
      this.hull.texture = this.stages[stage]
    }
    this.hull.tint = now - this.lastHitStep < HIT_FLASH_STEPS ? HIT_TINT : 0xffffff

    this.flame.visible = stage === 'critical'
    if (this.flame.visible) {
      // Flicker on simulation time, so it freezes with the match.
      const frame = Math.floor(now / 6) % this.flames.length
      this.flame.texture = this.flames[frame] ?? this.flame.texture
      this.flame.scale.set(0.9 + 0.15 * Math.sin(now * 0.4))
    }

    const ratio = Math.max(0, ship.health / ship.maxHealth)
    this.healthFill.scale.x = ratio
    this.healthFill.tint = ratio > 2 / 3 ? HEALTH_COLORS.high : ratio > 1 / 3 ? HEALTH_COLORS.medium : HEALTH_COLORS.low
  }

  /** Textures are shared through the asset cache, so only the view's own objects are destroyed. */
  destroy(): void {
    this.root.destroy({ children: true, context: true })
  }
}
