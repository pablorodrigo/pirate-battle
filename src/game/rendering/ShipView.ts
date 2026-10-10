import { Container, Graphics } from 'pixi.js'
import type { Ship, ShipKind } from '../core/entities.ts'
import { angleDifference } from '../core/math/geometry.ts'

const HULL_COLORS: Readonly<Record<ShipKind, number>> = {
  player: 0xf4efe1,
  chaser: 0xe5533d,
  shooter: 0xf2b33d,
}
const OUTLINE_COLOR = 0x0b2a3c
const HEALTH_COLORS = { high: 0x4caf50, medium: 0xf2b33d, low: 0xe5533d } as const
/** Hull tint per damage stage: the ship darkens as it loses health. */
const WEAR_TINTS = { intact: 0xffffff, damaged: 0xb8b8b8, critical: 0x6f6f6f } as const
const HEALTH_BAR_HEIGHT = 5
const HEALTH_BAR_GAP = 14
const HIT_FLASH_STEPS = 8

/**
 * Blockout view of a ship: a directional hull that darkens with damage and
 * flashes when hit, and a health bar that stays level above it. It only
 * reads the ship; it never changes game state.
 */
export class ShipView {
  readonly root = new Container()
  private readonly hull = new Graphics()
  private readonly hitFlash = new Graphics()
  private readonly healthFill = new Graphics()
  private lastHitStep = Number.NEGATIVE_INFINITY

  constructor(ship: Ship) {
    const r = ship.radius
    const outline = [r * 1.3, 0, -r, -r * 0.75, -r * 0.55, 0, -r, r * 0.75]
    this.hull.poly(outline).fill(HULL_COLORS[ship.kind]).stroke({ width: 2, color: OUTLINE_COLOR })
    this.hitFlash.poly(outline).fill(0xffffff)
    this.hitFlash.alpha = 0

    const barWidth = r * 2
    const barY = -r - HEALTH_BAR_GAP
    const healthBackground = new Graphics()
      .rect(-barWidth / 2 - 1, barY - 1, barWidth + 2, HEALTH_BAR_HEIGHT + 2)
      .fill(OUTLINE_COLOR)
    this.healthFill.rect(0, 0, barWidth, HEALTH_BAR_HEIGHT).fill(0xffffff)
    this.healthFill.position.set(-barWidth / 2, barY)

    this.root.addChild(this.hull, this.hitFlash, healthBackground, this.healthFill)
  }

  flash(now: number): void {
    this.lastHitStep = now
  }

  /** Draws the ship between its last two simulated poses. */
  update(ship: Ship, alpha: number, now: number): void {
    this.root.position.set(
      ship.previousX + (ship.x - ship.previousX) * alpha,
      ship.previousY + (ship.y - ship.previousY) * alpha,
    )
    const rotation = ship.previousAngle + angleDifference(ship.previousAngle, ship.angle) * alpha
    this.hull.rotation = rotation
    this.hitFlash.rotation = rotation
    this.hitFlash.alpha = Math.max(0, 1 - (now - this.lastHitStep) / HIT_FLASH_STEPS) * 0.8

    const ratio = Math.max(0, ship.health / ship.maxHealth)
    this.healthFill.scale.x = ratio
    this.healthFill.tint = ratio > 2 / 3 ? HEALTH_COLORS.high : ratio > 1 / 3 ? HEALTH_COLORS.medium : HEALTH_COLORS.low
    this.hull.tint = ratio > 2 / 3 ? WEAR_TINTS.intact : ratio > 1 / 3 ? WEAR_TINTS.damaged : WEAR_TINTS.critical
  }

  destroy(): void {
    this.root.destroy({ children: true, context: true })
  }
}
