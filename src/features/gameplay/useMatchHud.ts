import { useSyncExternalStore } from 'react'
import type { GameRuntime, HudSnapshot } from '../../game/runtime/GameRuntime.ts'

const subscribeToNothing = () => () => {}
const noSnapshot = () => null

/**
 * Reads the match summary for React. The runtime only publishes a new
 * snapshot when a displayed value changes, so React never renders per frame.
 */
export function useMatchHud(runtime: GameRuntime | null): HudSnapshot | null {
  return useSyncExternalStore(
    runtime ? runtime.subscribe : subscribeToNothing,
    runtime ? runtime.getHudSnapshot : noSnapshot,
  )
}
