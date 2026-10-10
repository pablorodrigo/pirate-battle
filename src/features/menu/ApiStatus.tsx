import { useQuery } from '@tanstack/react-query'
import { fetchApiHealth } from '../../shared/api/healthApi.ts'

const STATUS_LABELS = {
  pending: 'checking…',
  error: 'unavailable',
  success: 'online',
} as const

export function ApiStatus() {
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: ({ signal }) => fetchApiHealth(signal),
  })

  return <p role="status">Mock API: {STATUS_LABELS[health.status]}</p>
}
