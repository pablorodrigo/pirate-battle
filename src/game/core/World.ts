import type { ArenaDefinition } from '../config/ArenaDefinition.ts'
import type { GameplayConfig } from '../config/GameplayConfig.ts'
import { createPlayerShip, type EnemyShip, type PlayerShip, type Projectile } from './entities.ts'
import type { GameEvent } from './events.ts'

/** Mutable state of one match. Systems change it; presentation only reads it. */
export class World {
  readonly arena: ArenaDefinition
  readonly player: PlayerShip
  readonly enemies: EnemyShip[] = []
  readonly projectiles: Projectile[] = []
  /** Events of the current step, drained by the runtime after each frame. */
  readonly events: GameEvent[] = []
  /** Simulated steps of active play. */
  step = 0
  score = 0
  private lastId = 0

  constructor(config: GameplayConfig, arena: ArenaDefinition) {
    this.arena = arena
    this.player = createPlayerShip(this.nextId(), config.player, arena.playerStart)
  }

  nextId(): number {
    this.lastId += 1
    return this.lastId
  }

  emit(event: GameEvent): void {
    this.events.push(event)
  }

  /** Keeps the pose of every entity at the start of the step. */
  savePreviousPoses(): void {
    const ships = [this.player, ...this.enemies]
    for (const ship of ships) {
      ship.previousX = ship.x
      ship.previousY = ship.y
      ship.previousAngle = ship.angle
    }
    for (const projectile of this.projectiles) {
      projectile.previousX = projectile.x
      projectile.previousY = projectile.y
    }
  }

  /** Drops destroyed enemies and spent projectiles once the step is over. */
  removeInactive(): void {
    removeWhere(this.enemies, (enemy) => !enemy.alive)
    removeWhere(this.projectiles, (projectile) => !projectile.active)
  }
}

function removeWhere<T>(items: T[], shouldRemove: (item: T) => boolean): void {
  let kept = 0
  for (const item of items) {
    if (!shouldRemove(item)) {
      items[kept] = item
      kept += 1
    }
  }
  items.length = kept
}
