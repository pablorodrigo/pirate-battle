import { useEffect } from 'react'

const cancel = (event: Event): void => event.preventDefault()

/**
 * Keeps the page from zooming while the game screen is up, so two thumbs on
 * the controls never pinch it. `touch-action` covers standard browsers; iOS
 * Safari ignores `user-scalable=no` and zooms through its own gesture events,
 * which are cancelled here until the screen unmounts.
 */
export function useNoPageZoom(): void {
  useEffect(() => {
    document.addEventListener('gesturestart', cancel)
    document.addEventListener('gesturechange', cancel)
    return () => {
      document.removeEventListener('gesturestart', cancel)
      document.removeEventListener('gesturechange', cancel)
    }
  }, [])
}
