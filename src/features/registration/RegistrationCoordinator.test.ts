import { QueryClient } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NETWORK_CHANGED_EVENT } from '../../shared/api/networkEvents.ts'
import type { CompletedMatch, RegisterMatchResponse } from '../../shared/contracts/matches.ts'
import type { JournalState, PendingRegistration } from './matchJournal.ts'
import { RegistrationCoordinator } from './RegistrationCoordinator.ts'

const registerMatch = vi.hoisted(() => vi.fn<(match: CompletedMatch) => Promise<RegisterMatchResponse>>())

vi.mock('../../shared/api/matchesApi.ts', () => ({ registerMatch }))

const MATCH: CompletedMatch = {
  matchId: 'match-1',
  playerId: 'player-1',
  playerName: 'Captain Test',
  completedAt: '2026-10-10T12:00:00.000Z',
  score: 3,
  durationMs: 120_000,
  endReason: 'timeout',
  rulesetId: 'r1-d120-s2.5',
  config: { rulesVersion: 1, matchDurationSeconds: 120, spawnIntervalSeconds: 2.5 },
}

const REGISTERED: RegisterMatchResponse = {
  match: { ...MATCH, registeredAt: '2026-10-10T12:00:01.000Z' },
  created: true,
  revision: 1,
}

/** An in-memory journal with the same outbox transitions as the real one. */
function journalWith(...matches: CompletedMatch[]) {
  let state: JournalState = {
    lastResult: null,
    showResultOnLoad: false,
    outbox: matches.map((match) => ({ match, attempts: 0, state: 'pending', lastError: null })),
    persisted: true,
  }
  const listeners = new Set<() => void>()
  const setOutbox = (outbox: readonly PendingRegistration[]) => {
    state = { ...state, outbox }
    for (const listener of listeners) {
      listener()
    }
  }
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    confirm: (matchId: string) => setOutbox(state.outbox.filter((entry) => entry.match.matchId !== matchId)),
    recordFailure: (matchId: string, message: string, permanent: boolean) =>
      setOutbox(
        state.outbox.map((entry) =>
          entry.match.matchId === matchId
            ? { ...entry, attempts: entry.attempts + 1, state: permanent ? 'failed' : 'pending', lastError: message }
            : entry,
        ),
      ),
    requeue: (matchId: string) =>
      setOutbox(
        state.outbox.map((entry) =>
          entry.match.matchId === matchId ? { ...entry, state: 'pending', lastError: null } : entry,
        ),
      ),
  }
}

function httpError(status: number): AxiosError {
  const response = { status, statusText: '', data: null, headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError(`HTTP ${status}`, AxiosError.ERR_BAD_REQUEST, undefined, undefined, response as AxiosResponse)
}

function networkError(): AxiosError {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK)
}

/** Lets the mutation's promise chain run. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

function startCoordinator(journal: ReturnType<typeof journalWith>): RegistrationCoordinator {
  const coordinator = new RegistrationCoordinator(new QueryClient(), journal)
  coordinator.start()
  return coordinator
}

describe('RegistrationCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // The coordinator only listens to window events: online, network changes and unloading.
    vi.stubGlobal('window', new EventTarget())
    registerMatch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('sends pending registrations on start and removes them once confirmed', async () => {
    const journal = journalWith(MATCH)
    registerMatch.mockResolvedValue(REGISTERED)
    startCoordinator(journal)
    await settle()
    expect(registerMatch).toHaveBeenCalledTimes(1)
    expect(journal.getState().outbox).toEqual([])
  })

  it('backs off after a transient failure and then retries on its own', async () => {
    const journal = journalWith(MATCH)
    registerMatch.mockRejectedValueOnce(networkError()).mockResolvedValue(REGISTERED)
    startCoordinator(journal)
    await settle()
    expect(journal.getState().outbox[0]).toMatchObject({ state: 'pending', attempts: 1 })

    await vi.advanceTimersByTimeAsync(999)
    expect(registerMatch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(registerMatch).toHaveBeenCalledTimes(2)
    expect(journal.getState().outbox).toEqual([])
  })

  it('keeps a rejected registration for a manual retry', async () => {
    const journal = journalWith(MATCH)
    registerMatch.mockRejectedValueOnce(httpError(400)).mockResolvedValue(REGISTERED)
    const coordinator = startCoordinator(journal)
    await settle()
    expect(coordinator.statusOf(MATCH.matchId)).toMatchObject({ kind: 'failed' })

    await vi.advanceTimersByTimeAsync(60_000)
    expect(registerMatch).toHaveBeenCalledTimes(1)
    coordinator.retry(MATCH.matchId)
    await settle()
    expect(coordinator.statusOf(MATCH.matchId)).toEqual({ kind: 'confirmed' })
  })

  it('records no failure for an answer that arrives while the page unloads', async () => {
    const journal = journalWith(MATCH)
    let reject: (error: unknown) => void = () => {}
    registerMatch.mockReturnValue(new Promise((_resolve, fail) => (reject = fail)))
    startCoordinator(journal)
    await settle()

    // A request the mock API no longer serves reaches the real server, which knows nothing about matches.
    window.dispatchEvent(new Event('beforeunload'))
    reject(httpError(404))
    await settle()
    expect(journal.getState().outbox[0]).toMatchObject({ state: 'pending', attempts: 0, lastError: null })
  })

  it('sends nothing once the page starts unloading', async () => {
    const journal = journalWith(MATCH)
    registerMatch.mockRejectedValueOnce(networkError()).mockResolvedValue(REGISTERED)
    startCoordinator(journal)
    await settle()

    window.dispatchEvent(new Event('beforeunload'))
    await vi.advanceTimersByTimeAsync(60_000)
    window.dispatchEvent(new Event(NETWORK_CHANGED_EVENT))
    await settle()
    expect(registerMatch).toHaveBeenCalledTimes(1)
    expect(journal.getState().outbox[0]).toMatchObject({ state: 'pending', attempts: 1 })
  })
})
