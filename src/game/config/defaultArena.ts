import type { ArenaDefinition } from './ArenaDefinition.ts'
import { deepFreeze } from './deepFreeze.ts'

// Islands are multiples of the 64-unit tile of the art, so the tile sheet can
// draw them without scaling.
export const defaultArena: ArenaDefinition = deepFreeze({
  width: 1280,
  height: 720,
  islands: [
    { x: 192, y: 128, width: 192, height: 128 },
    { x: 896, y: 128, width: 192, height: 128 },
    { x: 544, y: 288, width: 192, height: 128 },
    { x: 192, y: 480, width: 192, height: 128 },
    { x: 896, y: 480, width: 192, height: 128 },
  ],
  playerStart: { x: 320, y: 368, angle: 0 },
  safeSpawnPoints: [
    { x: 1216, y: 64 },
    { x: 1216, y: 360 },
    { x: 1216, y: 656 },
    { x: 800, y: 360 },
    { x: 640, y: 64 },
    { x: 640, y: 656 },
    { x: 64, y: 64 },
    { x: 64, y: 656 },
  ],
})
