import { QueryClient } from '@tanstack/react-query'
import { isRetryable } from '../shared/api/apiErrors.ts'

/** At most two retries of transient failures, 1 s and then 2 s apart; client errors are never retried. */
const MAX_RETRIES = 2

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryable(error),
        retryDelay: (attempt) => 1000 * 2 ** attempt,
      },
      mutations: {
        // The registration coordinator owns retries, so mutations never retry on their own.
        retry: false,
      },
    },
  })
}
