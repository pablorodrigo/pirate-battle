import type { EndReason } from '../../shared/contracts/matches.ts'

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export const END_REASON_LABELS: Readonly<Record<EndReason, string>> = {
  timeout: 'Time ran out',
  death: 'Ship destroyed',
}
