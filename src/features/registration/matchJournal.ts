import { parseCompletedMatch, type CompletedMatch } from '../../shared/contracts/matches.ts'
import { readStored, removeStored, writeStored } from '../../shared/storage/localStore.ts'

export type PendingRegistration = {
  readonly match: CompletedMatch
  readonly attempts: number
  /** Failed registrations need a manual retry; pending ones retry on their own. */
  readonly state: 'pending' | 'failed'
  readonly lastError: string | null
}

export type JournalState = {
  readonly lastResult: CompletedMatch | null
  /** Reopen the result screen after a reload, until the player leaves it. */
  readonly showResultOnLoad: boolean
  readonly outbox: readonly PendingRegistration[]
  /** False when the last write failed: nothing written since will survive a reload. */
  readonly persisted: boolean
}

const STORAGE_KEY = 'pirate-battle:journal'
const STORAGE_VERSION = 1
const EMPTY: JournalState = { lastResult: null, showResultOnLoad: false, outbox: [], persisted: true }

function parsePending(value: unknown): PendingRegistration {
  const source = value as Record<string, unknown>
  const attempts = source.attempts
  const lastError = source.lastError
  return {
    match: parseCompletedMatch(source.match),
    attempts: typeof attempts === 'number' && attempts >= 0 ? attempts : 0,
    state: source.state === 'failed' ? 'failed' : 'pending',
    lastError: typeof lastError === 'string' ? lastError : null,
  }
}

export function parseJournal(data: unknown): JournalState | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const source = data as Record<string, unknown>
  if (!Array.isArray(source.outbox)) {
    return null
  }
  return {
    lastResult: source.lastResult === null ? null : parseCompletedMatch(source.lastResult),
    showResultOnLoad: source.showResultOnLoad === true,
    outbox: source.outbox.map(parsePending),
    persisted: true,
  }
}

/**
 * The client's durable record of finished matches: the last result and the
 * outbox of registrations not confirmed by the server yet. Every change is
 * written as one unit, so a result never exists without its registration.
 */
class MatchJournal {
  private state: JournalState = readStored(STORAGE_KEY, STORAGE_VERSION, parseJournal) ?? EMPTY
  private readonly listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getState = (): JournalState => this.state

  /** Saves the result and queues its registration in the same write, before any request. */
  recordCompleted(match: CompletedMatch): void {
    const outbox = this.state.outbox.filter((entry) => entry.match.matchId !== match.matchId)
    this.update({
      lastResult: match,
      showResultOnLoad: true,
      outbox: [...outbox, { match, attempts: 0, state: 'pending', lastError: null }],
    })
  }

  confirm(matchId: string): void {
    this.update({ outbox: this.state.outbox.filter((entry) => entry.match.matchId !== matchId) })
  }

  recordFailure(matchId: string, message: string, permanent: boolean): void {
    this.update({
      outbox: this.state.outbox.map((entry) =>
        entry.match.matchId === matchId
          ? { ...entry, attempts: entry.attempts + 1, state: permanent ? 'failed' : 'pending', lastError: message }
          : entry,
      ),
    })
  }

  /** Puts a failed registration back in the queue after the player asks to retry. */
  requeue(matchId: string): void {
    this.update({
      outbox: this.state.outbox.map((entry) =>
        entry.match.matchId === matchId ? { ...entry, state: 'pending', lastError: null } : entry,
      ),
    })
  }

  dismissResult(): void {
    if (this.state.showResultOnLoad) {
      this.update({ showResultOnLoad: false })
    }
  }

  /** Forgets the demo's results and pending registrations. */
  clear(): void {
    removeStored(STORAGE_KEY)
    this.state = EMPTY
    this.notify()
  }

  private update(change: Partial<Omit<JournalState, 'persisted'>>): void {
    const next = { ...this.state, ...change }
    const { persisted: _ignored, ...stored } = next
    this.state = { ...next, persisted: writeStored(STORAGE_KEY, STORAGE_VERSION, stored) }
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export const matchJournal = new MatchJournal()
