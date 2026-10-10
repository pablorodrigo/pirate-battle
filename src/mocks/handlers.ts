import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../shared/api/apiBaseUrl.ts'
import type { ApiHealth } from '../shared/contracts/apiHealth.ts'

export const handlers = [
  http.get(`${API_BASE_URL}/health`, () => HttpResponse.json<ApiHealth>({ status: 'ok' })),
]
