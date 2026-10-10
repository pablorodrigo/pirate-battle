import type { Point, Rect } from '../core/math/geometry.ts'

export type ShipPlacement = {
  readonly x: number
  readonly y: number
  /** Radians; 0 points along +x. */
  readonly angle: number
}

/** Arena layout in logical units; rendering scales it to fit the screen. */
export type ArenaDefinition = {
  readonly width: number
  readonly height: number
  /** Islands block ships and projectiles. */
  readonly islands: readonly Rect[]
  readonly playerStart: ShipPlacement
  /** Fallback spawn points, tried when no random position is safe. */
  readonly safeSpawnPoints: readonly Point[]
}
