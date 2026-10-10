import type { ArenaDefinition } from '../../config/ArenaDefinition.ts'
import type { Rect } from '../math/geometry.ts'

/** Side of a map cell: the 64-unit tile of the art, so obstacles are drawn without scaling. */
export const MAP_TILE = 64

/** A sand island takes any size, a grass island is the art's 4×4 block and a reef is one rock. */
export type ObstacleKind = 'sand' | 'grass' | 'reef'

/** Borders an obstacle touches. Its art runs on past them, as a stretch of coast. */
export type Coast = {
  readonly top: boolean
  readonly right: boolean
  readonly bottom: boolean
  readonly left: boolean
}

export type MapObstacle = {
  readonly kind: ObstacleKind
  /** Whole tiles the art covers, cut only where the arena border ends them. */
  readonly area: Rect
  /** What ships and projectiles hit: the whole area, or the rock inside it for a reef. */
  readonly collider: Rect
  readonly coast: Coast
}

/**
 * The map of one match: the arena the rules play on, plus the obstacles its
 * islands came from, which tell the renderer what to draw over each collider.
 */
export type MapLayout = {
  readonly kind: 'classic' | 'generated'
  readonly arena: ArenaDefinition
  readonly obstacles: readonly MapObstacle[]
}
