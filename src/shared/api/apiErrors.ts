import { isAxiosError } from 'axios'
import { ContractError } from '../contracts/matches.ts'

export type ApiFailure = {
  readonly kind: 'network' | 'timeout' | 'http' | 'invalid-response' | 'cancelled' | 'unknown'
  readonly status: number | null
  /** Transient failures are retried; client errors and broken responses are not. */
  readonly retryable: boolean
  readonly message: string
}

export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof ContractError) {
    return { kind: 'invalid-response', status: null, retryable: false, message: 'The server sent an unexpected response.' }
  }
  if (!isAxiosError(error)) {
    return { kind: 'unknown', status: null, retryable: false, message: 'Something went wrong.' }
  }
  if (error.code === 'ERR_CANCELED') {
    return { kind: 'cancelled', status: null, retryable: false, message: 'The request was cancelled.' }
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return { kind: 'timeout', status: null, retryable: true, message: 'The server took too long to answer.' }
  }
  const status = error.response?.status
  if (status === undefined) {
    return { kind: 'network', status: null, retryable: true, message: 'The server could not be reached.' }
  }
  const retryable = status >= 500 || status === 408 || status === 429
  return {
    kind: 'http',
    status,
    retryable,
    message: retryable ? `The server is unavailable (HTTP ${status}).` : `The server rejected the request (HTTP ${status}).`,
  }
}

export function isRetryable(error: unknown): boolean {
  return toApiFailure(error).retryable
}
