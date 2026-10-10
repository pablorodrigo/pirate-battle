export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Axios gives up after this long; the mock scenarios scale their delays from it. */
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 8000)
