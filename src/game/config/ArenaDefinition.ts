import type { Rect } from '../core/math/geometry.ts'

/** Arena layout in logical units; rendering scales it to fit the screen. */
export type ArenaDefinition = {
  readonly width: number
  readonly height: number
  readonly islands: readonly Rect[]
}
