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
const portrait = mediaQueryStore('(orientation: portrait)')

/**
 * How the game screen arranges the HUD and the controls around the arena:
 * keyboard players get the HUD above it. Touch screens play in both
 * orientations: landscape puts the HUD and the on-screen controls in the
 * columns beside the arena, portrait puts the HUD above it and the controls
 * below it.
 */
export type ScreenLayout = 'keyboard' | 'landscape' | 'portrait'

/** Touch screens get on-screen controls. */
function useTouchDevice(): boolean {
  return useSyncExternalStore(touch.subscribe, touch.getSnapshot) || navigator.maxTouchPoints > 0
}

/** Follows the device as it turns; the match rules never depend on it. */
export function useScreenLayout(): ScreenLayout {
  const touchDevice = useTouchDevice()
  const upright = useSyncExternalStore(portrait.subscribe, portrait.getSnapshot)
  if (!touchDevice) {
    return 'keyboard'
  }
  return upright ? 'portrait' : 'landscape'
}
