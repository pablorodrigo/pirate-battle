import { useSyncExternalStore } from 'react'
import {
  defaultMatchSettings,
  isValidMatchSettings,
  type MatchSettings,
} from '../../game/config/matchSettings.ts'
import { readStored, writeStored } from '../../shared/storage/localStore.ts'

const STORAGE_KEY = 'pirate-battle:settings'
const STORAGE_VERSION = 1

export function parseSettings(data: unknown): MatchSettings | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const { matchDurationSeconds, spawnIntervalSeconds } = data as Record<string, unknown>
  if (typeof matchDurationSeconds !== 'number' || typeof spawnIntervalSeconds !== 'number') {
    return null
  }
  const settings = { matchDurationSeconds, spawnIntervalSeconds }
  return isValidMatchSettings(settings) ? settings : null
}

let current: MatchSettings = readStored(STORAGE_KEY, STORAGE_VERSION, parseSettings) ?? defaultMatchSettings
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSettings(): MatchSettings {
  return current
}

/**
 * Applies validated settings to the next matches and persists them. Returns
 * false when they could not be stored, in which case they last until reload.
 */
export function saveSettings(settings: MatchSettings): boolean {
  current = settings
  for (const listener of listeners) {
    listener()
  }
  return writeStored(STORAGE_KEY, STORAGE_VERSION, settings)
}

export function useSettings(): MatchSettings {
  return useSyncExternalStore(subscribe, getSettings)
}
