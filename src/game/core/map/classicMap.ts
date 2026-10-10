import { deepFreeze } from '../../config/deepFreeze.ts'
import { defaultArena } from '../../config/defaultArena.ts'
import type { MapLayout } from './MapLayout.ts'

/**
 * The five fixed sand islands. The generator falls back to it, and tests that
 * place ships at known spots pin it.
 */
export const classicMap: MapLayout = deepFreeze({
  kind: 'classic',
  arena: defaultArena,
  obstacles: defaultArena.islands.map((island) => ({
    kind: 'sand',
    area: island,
    collider: island,
    coast: { top: false, right: false, bottom: false, left: false },
  })),
})
