import { createContext, useContext } from 'react'

/** The menus' sounds: a press, opening a screen, closing it and going back. */
export type InterfaceSound = 'click' | 'open' | 'close' | 'back'

/**
 * Plays an interface sound. The app provides it from the game's sound bank,
 * so the shared UI never depends on the game; without a provider, buttons
 * stay silent.
 */
export const InterfaceSoundContext = createContext<(sound: InterfaceSound) => void>(() => undefined)

export function useInterfaceSound(): (sound: InterfaceSound) => void {
  return useContext(InterfaceSoundContext)
}
