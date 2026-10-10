import { delay, http, HttpResponse, type JsonBodyType } from 'msw'
import { API_BASE_URL, API_TIMEOUT_MS } from '../shared/api/apiConfig.ts'
import type { ApiHealth } from '../shared/contracts/apiHealth.ts'
import { parseCompletedMatch, type ApiErrorBody, type CompletedMatch } from '../shared/contracts/matches.ts'
import type { RegisterOutcome } from './MatchRepository.ts'
import { mockServer } from './mockServer.ts'

type Operation = 'health' | 'ranking' | 'history' | 'register'

type Plan = {
  readonly delayMs: number
  readonly failure: (() => Response) | null
}

const BASE_LATENCY_MS = 120
const MAX_PAGE_SIZE = 50
const NETWORK_SEED = 2026
/** Long enough that the client always gives up first. */
const PAST_TIMEOUT_MS = API_TIMEOUT_MS * 1.25

function errorResponse(status: number, code: string, message: string): Response {
  return HttpResponse.json<ApiErrorBody>({ code, message }, { status })
}

/** Reproducible fraction in [0, 1) for the n-th request (mulberry32 over seed + n). */
function seededFraction(index: number): number {
  let t = (NETWORK_SEED + index * 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
}

/** How the selected scenario treats this request. */
function planFor(operation: Operation, index: number): Plan {
  const ok = (delayMs = BASE_LATENCY_MS): Plan => ({ delayMs, failure: null })
  const fail = (status: number, code: string, message: string): Plan => ({
    delayMs: BASE_LATENCY_MS,
    failure: () => errorResponse(status, code, message),
  })
  switch (mockServer.scenario) {
    case 'slow':
      return ok(API_TIMEOUT_MS * 0.5)
    case 'variable-latency':
      return ok(API_TIMEOUT_MS * (0.05 + 0.85 * seededFraction(index)))
    case 'out-of-order':
      return ok(operation !== 'register' && index % 2 === 1 ? API_TIMEOUT_MS * 0.7 : BASE_LATENCY_MS)
    case 'ranking-error':
      return operation === 'ranking' ? fail(500, 'ranking_unavailable', 'The ranking is unavailable.') : ok()
    case 'history-error':
      return operation === 'history' ? fail(500, 'history_unavailable', 'The history is unavailable.') : ok()
    case 'http-4xx':
      return fail(400, 'bad_request', 'The request was rejected.')
    case 'http-5xx':
      return fail(503, 'service_unavailable', 'The service is temporarily unavailable.')
    case 'network-error':
    case 'unavailable':
      return { delayMs: BASE_LATENCY_MS, failure: () => HttpResponse.error() }
    case 'timeout':
      return { delayMs: PAST_TIMEOUT_MS, failure: () => errorResponse(504, 'timeout', 'The server timed out.') }
    case 'commit-then-timeout':
      return ok(operation === 'register' ? PAST_TIMEOUT_MS : BASE_LATENCY_MS)
    case 'success':
    case 'empty':
    case 'paginated':
      return ok()
  }
}

/**
 * Answers a read under the selected scenario. Out-of-order reads capture
 * their body when they arrive, so a slow read answers with the data of its
 * time, after newer reads have already answered.
 */
async function read(operation: Exclude<Operation, 'register'>, body: () => JsonBodyType): Promise<Response> {
  const plan = planFor(operation, mockServer.nextRequestIndex())
  const snapshot = mockServer.scenario === 'out-of-order' ? body() : null
  await delay(plan.delayMs)
  if (plan.failure) {
    return plan.failure()
  }
  return HttpResponse.json(snapshot ?? body())
}

function pageParams(url: URL): { page: number; pageSize: number } | null {
  const page = Number(url.searchParams.get('page') ?? 1)
  const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
  const valid = Number.isInteger(page) && page >= 1 && Number.isInteger(pageSize) && pageSize >= 1
  return valid && pageSize <= MAX_PAGE_SIZE ? { page, pageSize } : null
}

function registration(outcome: RegisterOutcome): Response {
  switch (outcome.kind) {
    case 'created':
      return HttpResponse.json({ match: outcome.match, created: true, revision: outcome.revision }, { status: 201 })
    case 'existing':
      return HttpResponse.json({ match: outcome.match, created: false, revision: outcome.revision }, { status: 200 })
    case 'conflict':
      return errorResponse(409, 'conflict', 'Another match was already registered with this id.')
  }
}

async function parseSubmission(request: Request): Promise<CompletedMatch | null> {
  try {
    const match = parseCompletedMatch(await request.json())
    return request.headers.get('Idempotency-Key') === match.matchId ? match : null
  } catch {
    return null
  }
}

export const handlers = [
  http.get(`${API_BASE_URL}/health`, () => read('health', (): ApiHealth => ({ status: 'ok' }))),

  http.get(`${API_BASE_URL}/ranking`, ({ request }) => {
    const url = new URL(request.url)
    const rulesetId = url.searchParams.get('rulesetId')
    const params = pageParams(url)
    if (!rulesetId || !params) {
      return errorResponse(400, 'invalid_query', 'rulesetId, page and pageSize are required.')
    }
    return read('ranking', () => mockServer.repository.ranking(rulesetId, params.page, params.pageSize))
  }),

  http.get(`${API_BASE_URL}/players/:playerId/matches`, ({ request, params }) => {
    const playerId = typeof params.playerId === 'string' ? params.playerId : ''
    const page = pageParams(new URL(request.url))
    if (!playerId || !page) {
      return errorResponse(400, 'invalid_query', 'A player id, page and pageSize are required.')
    }
    return read('history', () => mockServer.repository.history(playerId, page.page, page.pageSize))
  }),

  http.post(`${API_BASE_URL}/matches`, async ({ request }) => {
    const plan = planFor('register', mockServer.nextRequestIndex())
    const match = await parseSubmission(request)
    if (!match) {
      return errorResponse(400, 'invalid_match', 'The body must be a completed match keyed by its Idempotency-Key.')
    }
    if (mockServer.scenario === 'commit-then-timeout') {
      // Saved first, then the answer is lost: the client times out and resends.
      const outcome = mockServer.repository.register(match, new Date())
      await delay(plan.delayMs)
      return registration(outcome)
    }
    const generation = mockServer.epoch
    await delay(plan.delayMs)
    if (plan.failure) {
      return plan.failure()
    }
    // A request that started before a demo reset never writes into the restored data.
    if (mockServer.epoch !== generation) {
      return errorResponse(409, 'demo_reset', 'The demo data was reset while this request was in flight.')
    }
    return registration(mockServer.repository.register(match, new Date()))
  }),
]
