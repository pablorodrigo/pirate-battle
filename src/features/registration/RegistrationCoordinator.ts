import { MutationObserver, type QueryClient } from '@tanstack/react-query'
import { toApiFailure } from '../../shared/api/apiErrors.ts'
import { registerMatch } from '../../shared/api/matchesApi.ts'
import { NETWORK_CHANGED_EVENT } from '../../shared/api/networkEvents.ts'
import type { CompletedMatch, RegisterMatchResponse } from '../../shared/contracts/matches.ts'
import { matchQueryKeys } from '../leaderboards/queries.ts'
import type { JournalState } from './matchJournal.ts'

export type RegistrationStatus =
  | { readonly kind: 'confirmed' }
  | { readonly kind: 'sending' }
  /** Failed with a transient error; retries on its own. */
  | { readonly kind: 'waiting'; readonly attempts: number; readonly message: string }
  /** Rejected by the server; only a manual retry sends it again. */
  | { readonly kind: 'failed'; readonly message: string }

type Journal = {
  readonly getState: () => JournalState
  readonly subscribe: (listener: () => void) => () => void
  confirm(matchId: string): void
  recordFailure(matchId: string, message: string, permanent: boolean): void
  requeue(matchId: string): void
}

const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30_000

/**
 * Sends the outbox of finished matches to the server, one request at a
 * time and never two for the same match. The request itself is a TanStack
 * Query mutation (with retries disabled); this coordinator owns the retry
 * policy: transient failures back off (1 s, 2 s, 4 s… up to 30 s) and
 * retry on their own, also as soon as the connection or the network
 * scenario changes; rejected registrations wait for a manual retry. A
 * registration in backoff never blocks the others. It lives for the whole
 * app, so leaving a screen or starting a new match never stops it.
 *
 * Once the page starts unloading it sends nothing more and records no
 * failure: the mock API stops serving a page at `beforeunload`, so a request
 * sent then reaches the real network and its error says nothing about the
 * match. The next visit resends what is still pending; resends are idempotent.
 */
export class RegistrationCoordinator {
  private readonly queryClient: QueryClient
  private readonly journal: Journal
  private readonly retryAt = new Map<string, number>()
  private readonly listeners = new Set<() => void>()
  private inFlight: string | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private version = 0
  private started = false
  private unloading = false

  constructor(queryClient: QueryClient, journal: Journal) {
    this.queryClient = queryClient
    this.journal = journal
    journal.subscribe(() => this.notify())
  }

  /** Resumes pending registrations left by a previous visit. */
  start(): void {
    if (this.started) {
      return
    }
    this.started = true
    window.addEventListener('online', this.retryNow)
    window.addEventListener(NETWORK_CHANGED_EVENT, this.retryNow)
    window.addEventListener('beforeunload', this.stop)
    this.flush()
  }

  /** Sends what is eligible now, for example right after a match is recorded. */
  sendPending(): void {
    this.flush()
  }

  /** Skips every backoff and sends what is pending, e.g. after reconnecting. */
  readonly retryNow = (): void => {
    this.retryAt.clear()
    this.flush()
  }

  /** Manual retry, also for registrations the server rejected. */
  retry(matchId: string): void {
    this.journal.requeue(matchId)
    this.retryAt.delete(matchId)
    this.flush()
  }

  /** Forgets scheduled retries, for a demo reset that also clears the journal. */
  reset(): void {
    this.retryAt.clear()
    this.clearTimer()
    this.notify()
  }

  statusOf(matchId: string): RegistrationStatus {
    const entry = this.journal.getState().outbox.find((pending) => pending.match.matchId === matchId)
    if (!entry) {
      return { kind: 'confirmed' }
    }
    if (entry.state === 'failed') {
      return { kind: 'failed', message: entry.lastError ?? 'The server rejected the match.' }
    }
    if (this.inFlight === matchId || entry.attempts === 0) {
      return { kind: 'sending' }
    }
    return { kind: 'waiting', attempts: entry.attempts, message: entry.lastError ?? '' }
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Changes whenever any status may have changed; pairs with useSyncExternalStore. */
  readonly getVersion = (): number => this.version

  private readonly stop = (): void => {
    this.unloading = true
    this.clearTimer()
  }

  private flush(): void {
    this.clearTimer()
    if (this.inFlight || this.unloading) {
      return
    }
    const now = Date.now()
    let nextWake = Number.POSITIVE_INFINITY
    for (const entry of this.journal.getState().outbox) {
      if (entry.state !== 'pending') {
        continue
      }
      const eligibleAt = this.retryAt.get(entry.match.matchId) ?? 0
      if (eligibleAt > now) {
        nextWake = Math.min(nextWake, eligibleAt)
        continue
      }
      this.send(entry.match)
      return
    }
    if (Number.isFinite(nextWake)) {
      this.timer = setTimeout(() => this.flush(), nextWake - now)
    }
  }

  private send(match: CompletedMatch): void {
    const { matchId } = match
    this.inFlight = matchId
    this.notify()
    const observer = new MutationObserver<RegisterMatchResponse, Error, CompletedMatch>(this.queryClient, {
      mutationKey: ['register-match', matchId],
      mutationFn: registerMatch,
    })
    observer.mutate(match).then(
      () => {
        this.inFlight = null
        this.retryAt.delete(matchId)
        this.journal.confirm(matchId)
        // Active lists refetch now (cancelling older requests); the others on their next display.
        void this.queryClient.invalidateQueries({ queryKey: matchQueryKeys.ranking })
        void this.queryClient.invalidateQueries({ queryKey: matchQueryKeys.history })
        this.flush()
      },
      (error: unknown) => {
        this.inFlight = null
        if (this.unloading) {
          return
        }
        const failure = toApiFailure(error)
        const previous = this.journal.getState().outbox.find((entry) => entry.match.matchId === matchId)
        this.journal.recordFailure(matchId, failure.message, !failure.retryable)
        if (failure.retryable) {
          const attempt = (previous?.attempts ?? 0) + 1
          this.retryAt.set(matchId, Date.now() + Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_MAX_MS))
        }
        this.flush()
      },
    )
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private notify(): void {
    this.version += 1
    for (const listener of this.listeners) {
      listener()
    }
  }
}
