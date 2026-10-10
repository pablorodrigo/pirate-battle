import axios from 'axios'
import { API_BASE_URL, API_TIMEOUT_MS } from './apiConfig.ts'

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})
