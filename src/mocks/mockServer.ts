import { NETWORK_CHANGED_EVENT } from '../shared/api/networkEvents.ts'
import { parseRegisteredMatch } from '../shared/contracts/matches.ts'
import { readStored, writeStored } from '../shared/storage/localStore.ts'
import type { FixtureCaptain } from './fixtures.ts'
import { MatchRepository, type MatchStore, type StoredDatabase } from './MatchRepository.ts'
import { isNetworkScenario, NETWORK_SCENARIOS, type NetworkScenario } from './networkScenarios.ts'

const DATABASE_KEY = 'pirate-battle:mock-database'
const SCENARIO_KEY = 'pirate-battle:network-scenario'
const STORAGE_VERSION = 1
const DATABASE_VERSION = 2

function parseDatabase(data: unknown): StoredDatabase | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const { revision, matches } = data as Record<string, unknown>
  if (typeof revision !== 'number' || !Array.isArray(matches)) {
    return null
  }
  return { revision, matches: matches.map(parseRegisteredMatch) }
}

const browserMatchStore: MatchStore = {
  load: () => readStored(DATABASE_KEY, DATABASE_VERSION, parseDatabase),
  save: (database) => {
    writeStored(DATABASE_KEY, DATABASE_VERSION, database)
  },
}

/**
 * State of the mock server, shared by the MSW handlers and the scenario
 * panel: the persisted database, the selected scenario and a generation
 * counter that requests check before writing, so nothing started before a
 * reset can write into the restored data.
 */
class MockServer {
  readonly repository = new MatchRepository(browserMatchStore)
  private currentScenario: NetworkScenario
  private generation = 0
  private requestCount = 0
  private readonly listeners = new Set<() => void>()

  constructor() {
    const stored = readStored(SCENARIO_KEY, STORAGE_VERSION, (data) => (isNetworkScenario(data) ? data : null))
    this.currentScenario = stored ?? 'success'
  }

  get scenario(): NetworkScenario {
    return this.currentScenario
  }

  get epoch(): number {
    return this.generation
  }

  /** Position of a request in the sequence, which makes seeded delays reproducible. */
  nextRequestIndex(): number {
    this.requestCount += 1
    return this.requestCount
  }

  /** `owner` is the local captain, whom a data preset may give matches of their own. */
  selectScenario(scenario: NetworkScenario, owner?: FixtureCaptain): void {
    const preset = NETWORK_SCENARIOS[scenario].preset
    if (preset) {
      this.generation += 1
      this.repository.reset(preset, owner)
    }
    this.currentScenario = scenario
    this.requestCount = 0
    writeStored(SCENARIO_KEY, STORAGE_VERSION, scenario)
    this.notify()
  }

  /** Restores the default fixtures and the success scenario. */
  resetDemoData(): void {
    this.generation += 1
    this.repository.reset('default')
    this.currentScenario = 'success'
    this.requestCount = 0
    writeStored(SCENARIO_KEY, STORAGE_VERSION, 'success')
    this.notify()
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getScenario = (): NetworkScenario => this.currentScenario

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
    window.dispatchEvent(new CustomEvent(NETWORK_CHANGED_EVENT, { detail: this.currentScenario }))
  }
}

export const mockServer = new MockServer()
