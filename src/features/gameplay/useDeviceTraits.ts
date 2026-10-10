import { useSyncExternalStore } from 'react'

function mediaQueryStore(query: string) {
  return {
    subscribe: (listener: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', listener)
      return () => list.removeEventListener('change', listener)
    },
    getSnapshot: () => window.matchMedia(query).matches,
  }
}

const touch = mediaQueryStore('(pointer: coarse)')
const portraitTouch = mediaQueryStore('(pointer: coarse) and (orientation: portrait)')

/**
 * How the game screen arranges the HUD and the controls around the arena:
 * keyboard players get the HUD above it; touch screens in landscape get the
 * HUD and the on-screen controls in the columns beside it.
 */
export type ScreenLayout = 'keyboard' | 'landscape'

/** Touch screens get on-screen controls. */
export function useTouchDevice(): boolean {
  return useSyncExternalStore(touch.subscribe, touch.getSnapshot) || navigator.maxTouchPoints > 0
}

/** The match is played in landscape on touch devices; portrait pauses it. */
export function usePortraitTouch(): boolean {
  return useSyncExternalStore(portraitTouch.subscribe, portraitTouch.getSnapshot)
}
