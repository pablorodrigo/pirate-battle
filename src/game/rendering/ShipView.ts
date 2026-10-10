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
const HEALTH_BAR_HEIGHT = 5
const HEALTH_BAR_GAP = 14

/**
 * Blockout view of a ship: a directional hull and a health bar that stays
 * level above it. It only reads the ship; it never changes game state.
 */
export class ShipView {
  readonly root = new Container()
  private readonly hull = new Graphics()
  private readonly healthFill = new Graphics()

  constructor(ship: Ship) {
    const r = ship.radius
    this.hull
      .poly([r * 1.3, 0, -r, -r * 0.75, -r * 0.55, 0, -r, r * 0.75])
      .fill(HULL_COLORS[ship.kind])
      .stroke({ width: 2, color: OUTLINE_COLOR })

    const barWidth = r * 2
    const barY = -r - HEALTH_BAR_GAP
    const healthBackground = new Graphics()
      .rect(-barWidth / 2 - 1, barY - 1, barWidth + 2, HEALTH_BAR_HEIGHT + 2)
      .fill(OUTLINE_COLOR)
    this.healthFill.rect(0, 0, barWidth, HEALTH_BAR_HEIGHT).fill(0xffffff)
    this.healthFill.position.set(-barWidth / 2, barY)

    this.root.addChild(this.hull, healthBackground, this.healthFill)
  }

  /** Draws the ship between its last two simulated poses. */
  update(ship: Ship, alpha: number): void {
    this.root.position.set(
      ship.previousX + (ship.x - ship.previousX) * alpha,
      ship.previousY + (ship.y - ship.previousY) * alpha,
    )
    this.hull.rotation = ship.previousAngle + angleDifference(ship.previousAngle, ship.angle) * alpha

    const ratio = Math.max(0, ship.health / ship.maxHealth)
    this.healthFill.scale.x = ratio
    this.healthFill.tint =
      ratio > 2 / 3 ? HEALTH_COLORS.high : ratio > 1 / 3 ? HEALTH_COLORS.medium : HEALTH_COLORS.low
  }

  destroy(): void {
    this.root.destroy({ children: true, context: true })
  }
}
