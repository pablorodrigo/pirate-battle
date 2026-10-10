import type { FixturePreset } from './fixtures.ts'

export type NetworkScenario =
  | 'success'
  | 'empty'
  | 'paginated'
  | 'slow'
  | 'variable-latency'
  | 'out-of-order'
  | 'ranking-error'
  | 'history-error'
  | 'http-4xx'
  | 'http-5xx'
  | 'network-error'
  | 'timeout'
  | 'commit-then-timeout'
  | 'unavailable'

export type ScenarioDefinition = {
  readonly label: string
  readonly description: string
  /** Data scenarios replace the mock database when selected. */
  readonly preset?: FixturePreset
}

export const NETWORK_SCENARIOS: Readonly<Record<NetworkScenario, ScenarioDefinition>> = {
  success: { label: 'Success', description: 'Every request succeeds after a short delay. Data is kept.' },
  empty: { label: 'Empty lists', description: 'Starts with no matches at all.', preset: 'empty' },
  paginated: {
    label: 'Many pages',
    description: 'Loads enough matches for several pages of the ranking and of your history.',
    preset: 'paginated',
  },
  slow: { label: 'Slow network', description: 'Every response takes about half the request timeout.' },
  'variable-latency': {
    label: 'Variable latency',
    description: 'Each response waits a seeded, reproducible delay between 5% and 90% of the timeout.',
  },
  'out-of-order': {
    label: 'Out-of-order responses',
    description: 'Every other read is slow and answers with the data from when it was sent, after newer reads.',
  },
  'ranking-error': { label: 'Ranking fails', description: 'Ranking reads fail with HTTP 500; everything else works.' },
  'history-error': { label: 'History fails', description: 'History reads fail with HTTP 500; everything else works.' },
  'http-4xx': { label: 'HTTP 400', description: 'Every request is rejected as a client error, which is never retried.' },
  'http-5xx': { label: 'HTTP 503', description: 'Every request fails with a server error, which is retried.' },
  'network-error': { label: 'Connection failure', description: 'Every request fails at the network level.' },
  timeout: { label: 'Timeout', description: 'Nothing answers before the request timeout; matches are not saved.' },
  'commit-then-timeout': {
    label: 'Saved, then timeout',
    description: 'Registering saves the match but the answer is lost; the resend must not duplicate it.',
  },
  unavailable: {
    label: 'Unavailable',
    description: 'The server is down until another scenario is selected; pending matches then register.',
  },
}

export function isNetworkScenario(value: unknown): value is NetworkScenario {
  return typeof value === 'string' && Object.hasOwn(NETWORK_SCENARIOS, value)
}
