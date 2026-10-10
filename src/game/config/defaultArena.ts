import type { ArenaDefinition } from './ArenaDefinition.ts'

export const defaultArena: ArenaDefinition = {
  width: 1280,
  height: 720,
  islands: [
    { x: 300, y: 150, width: 170, height: 120 },
    { x: 820, y: 430, width: 210, height: 140 },
    { x: 560, y: 540, width: 120, height: 90 },
  ],
}
