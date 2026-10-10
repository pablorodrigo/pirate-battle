/**
 * Versioned JSON storage on top of localStorage. Storage may be missing,
 * blocked or full, and stored data may be stale or corrupt, so reads fall
 * back to null and writes report whether they were persisted.
 */
type Envelope = {
  readonly version: number
  readonly data: unknown
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'version' in value && 'data' in value
}

export function readStored<T>(key: string, version: number, parse: (data: unknown) => T | null): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) {
      return null
    }
    const envelope: unknown = JSON.parse(raw)
    // An older schema is discarded rather than trusted.
    if (!isEnvelope(envelope) || envelope.version !== version) {
      return null
    }
    return parse(envelope.data)
  } catch {
    return null
  }
}

export function writeStored(key: string, version: number, data: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify({ version, data } satisfies Envelope))
    return true
  } catch {
    return false
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
