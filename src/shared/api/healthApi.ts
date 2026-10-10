import { parseApiHealth, type ApiHealth } from '../contracts/apiHealth.ts'
import { httpClient } from './httpClient.ts'

export async function fetchApiHealth(signal: AbortSignal): Promise<ApiHealth> {
  const response = await httpClient.get<unknown>('/health', { signal })
  return parseApiHealth(response.data)
}
