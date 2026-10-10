import { createId } from '../../shared/ids.ts'
import { readStored, writeStored } from '../../shared/storage/localStore.ts'

export type Player = {
  readonly id: string
  readonly name: string
}

const STORAGE_KEY = 'pirate-battle:player'
const STORAGE_VERSION = 1

function parsePlayer(data: unknown): Player | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const { id, name } = data as Record<string, unknown>
  return typeof id === 'string' && id && typeof name === 'string' && name ? { id, name } : null
}

function createPlayer(): Player {
  const id = createId()
  return { id, name: `Captain ${id.slice(0, 4).toUpperCase()}` }
}

let current: Player | null = null

/**
 * The local player, created on first use and kept between visits, so the
 * match history follows the same captain after a reload.
 */
export function getPlayer(): Player {
  if (!current) {
    current = readStored(STORAGE_KEY, STORAGE_VERSION, parsePlayer) ?? createPlayer()
    writeStored(STORAGE_KEY, STORAGE_VERSION, current)
  }
  return current
}
