import axios from 'axios'
import { API_BASE_URL } from './apiBaseUrl.ts'

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8_000,
  headers: { Accept: 'application/json' },
})
