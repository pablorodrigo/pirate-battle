import { useSyncExternalStore } from 'react'
import { soundBank } from '../../game/audio/SoundBank.ts'
import { readStored, writeStored } from '../../shared/storage/localStore.ts'

const STORAGE_KEY = 'pirate-battle:sound'
const STORAGE_VERSION = 1

export function parseSoundSetting(data: unknown): boolean | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const { enabled } = data as Record<string, unknown>
  return typeof enabled === 'boolean' ? enabled : null
}

let enabled = readStored(STORAGE_KEY, STORAGE_VERSION, parseSoundSetting) ?? true
// Applied when the app loads, before any match can play a sound.
soundBank.setEnabled(enabled)
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSoundEnabled(): boolean {
  return enabled
}

/**
 * Turns sound effects on or off at once and keeps the choice. Returns false
 * when it could not be stored, in which case it lasts until reload.
 */
export function saveSoundEnabled(value: boolean): boolean {
  enabled = value
  soundBank.setEnabled(value)
  for (const listener of listeners) {
    listener()
  }
  return writeStored(STORAGE_KEY, STORAGE_VERSION, { enabled: value })
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSoundEnabled)
}
