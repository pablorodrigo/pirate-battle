export type ApiHealth = {
  status: 'ok'
}

/** Response bodies are untrusted JSON, so they are validated at runtime. */
export function parseApiHealth(value: unknown): ApiHealth {
  if (typeof value === 'object' && value !== null && 'status' in value && value.status === 'ok') {
    return { status: 'ok' }
  }
  throw new TypeError('Unexpected API health response.')
}
