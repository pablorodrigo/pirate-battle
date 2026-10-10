/**
 * Contracts shared by the HTTP client and the mock server. Response bodies
 * are untrusted JSON, so every type comes with a runtime parser.
 */

export type EndReason = 'timeout' | 'death'

/** The rules a match ran on: the version fixes everything except the two Options settings. */
export type MatchConfigSnapshot = {
  readonly rulesVersion: number
  readonly matchDurationSeconds: number
  readonly spawnIntervalSeconds: number
}

export type CompletedMatch = {
  readonly matchId: string
  readonly playerId: string
  readonly playerName: string
  /** ISO 8601, UTC. */
  readonly completedAt: string
  readonly score: number
  /** Active play time, excluding pauses. */
  readonly durationMs: number
  readonly endReason: EndReason
  readonly rulesetId: string
  readonly config: MatchConfigSnapshot
}

export type RegisteredMatch = CompletedMatch & {
  readonly registeredAt: string
}

export type RankingEntry = {
  /** Position among every match of the same ruleset. */
  readonly rank: number
  readonly matchId: string
  readonly playerId: string
  readonly playerName: string
  readonly score: number
  readonly durationMs: number
  readonly completedAt: string
}

export type Page<T> = {
  readonly items: readonly T[]
  readonly page: number
  readonly pageSize: number
  readonly totalItems: number
  readonly totalPages: number
}

export type RegisterMatchResponse = {
  readonly match: RegisteredMatch
  /** False when the match was already registered: a resend returns the existing record. */
  readonly created: boolean
}

export type ApiErrorBody = {
  readonly code: string
  readonly message: string
}

type Parser<T> = (value: unknown) => T

export class ContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractError'
  }
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContractError(`${what} must be an object.`)
  }
  return value as Record<string, unknown>
}

function text(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new ContractError(`"${key}" must be a non-empty string.`)
  }
  return value
}

function count(source: Record<string, unknown>, key: string, min = 0): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new ContractError(`"${key}" must be an integer of at least ${min}.`)
  }
  return value
}

function finite(source: Record<string, unknown>, key: string): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContractError(`"${key}" must be a finite number.`)
  }
  return value
}

function isoDate(source: Record<string, unknown>, key: string): string {
  const value = text(source, key)
  if (Number.isNaN(Date.parse(value))) {
    throw new ContractError(`"${key}" must be an ISO 8601 date.`)
  }
  return value
}

export function parseConfigSnapshot(value: unknown): MatchConfigSnapshot {
  const source = record(value, 'config')
  return {
    rulesVersion: count(source, 'rulesVersion', 1),
    matchDurationSeconds: count(source, 'matchDurationSeconds', 1),
    spawnIntervalSeconds: finite(source, 'spawnIntervalSeconds'),
  }
}

export function parseCompletedMatch(value: unknown): CompletedMatch {
  const source = record(value, 'match')
  const endReason = source.endReason
  if (endReason !== 'timeout' && endReason !== 'death') {
    throw new ContractError('"endReason" must be "timeout" or "death".')
  }
  return {
    matchId: text(source, 'matchId'),
    playerId: text(source, 'playerId'),
    playerName: text(source, 'playerName'),
    completedAt: isoDate(source, 'completedAt'),
    score: count(source, 'score'),
    durationMs: count(source, 'durationMs'),
    endReason,
    rulesetId: text(source, 'rulesetId'),
    config: parseConfigSnapshot(source.config),
  }
}

export function parseRegisteredMatch(value: unknown): RegisteredMatch {
  return { ...parseCompletedMatch(value), registeredAt: isoDate(record(value, 'match'), 'registeredAt') }
}

export function parseRankingEntry(value: unknown): RankingEntry {
  const source = record(value, 'ranking entry')
  return {
    rank: count(source, 'rank', 1),
    matchId: text(source, 'matchId'),
    playerId: text(source, 'playerId'),
    playerName: text(source, 'playerName'),
    score: count(source, 'score'),
    durationMs: count(source, 'durationMs'),
    completedAt: isoDate(source, 'completedAt'),
  }
}

export function parsePage<T>(value: unknown, parseItem: Parser<T>): Page<T> {
  const source = record(value, 'page')
  const items = source.items
  if (!Array.isArray(items)) {
    throw new ContractError('"items" must be an array.')
  }
  return {
    items: items.map(parseItem),
    page: count(source, 'page', 1),
    pageSize: count(source, 'pageSize', 1),
    totalItems: count(source, 'totalItems'),
    totalPages: count(source, 'totalPages'),
  }
}

export function parseRegisterMatchResponse(value: unknown): RegisterMatchResponse {
  const source = record(value, 'registration')
  if (typeof source.created !== 'boolean') {
    throw new ContractError('"created" must be a boolean.')
  }
  return { match: parseRegisteredMatch(source.match), created: source.created }
}

/** Two submissions describe the same match only if every field matches. */
export function isSameMatch(a: CompletedMatch, b: CompletedMatch): boolean {
  return (
    a.matchId === b.matchId &&
    a.playerId === b.playerId &&
    a.playerName === b.playerName &&
    a.completedAt === b.completedAt &&
    a.score === b.score &&
    a.durationMs === b.durationMs &&
    a.endReason === b.endReason &&
    a.rulesetId === b.rulesetId &&
    a.config.rulesVersion === b.config.rulesVersion &&
    a.config.matchDurationSeconds === b.config.matchDurationSeconds &&
    a.config.spawnIntervalSeconds === b.config.spawnIntervalSeconds
  )
}

/** Ordinal comparison, independent of the browser locale; ISO dates sort chronologically. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Ranking order: higher score first, then longer survival, then the earlier
 * match, then the match id, so every position is deterministic.
 */
export function compareForRanking(a: CompletedMatch, b: CompletedMatch): number {
  return (
    b.score - a.score ||
    b.durationMs - a.durationMs ||
    compareText(a.completedAt, b.completedAt) ||
    compareText(a.matchId, b.matchId)
  )
}

/** History order: newest first, then the match id. */
export function compareForHistory(a: CompletedMatch, b: CompletedMatch): number {
  return compareText(b.completedAt, a.completedAt) || compareText(a.matchId, b.matchId)
}
