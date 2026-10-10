import { toApiFailure } from '../../shared/api/apiErrors.ts'
import { Button } from '../../shared/ui/Button.tsx'
import styles from './Leaderboards.module.css'

type ListStatusProps = {
  noun: string
  isPending: boolean
  isFetching: boolean
  hasData: boolean
  error: Error | null
  onRetry: () => void
}

/** Loading, refreshing and error states shared by both lists; data stays visible while refreshing. */
export function ListStatus({ noun, isPending, isFetching, hasData, error, onRetry }: ListStatusProps) {
  if (isPending) {
    return (
      <p className={styles.status} role="status">
        Loading {noun}…
      </p>
    )
  }
  if (error) {
    return (
      <div className={styles.error} role="alert">
        <p>
          {hasData ? `Showing saved ${noun}; it could not be refreshed.` : `The ${noun} could not be loaded.`}{' '}
          {toApiFailure(error).message}
        </p>
        <Button variant="secondary" size="small" onClick={onRetry} disabled={isFetching}>
          Try again
        </Button>
      </div>
    )
  }
  return (
    <p className={styles.status} role="status">
      {isFetching ? `Updating ${noun}…` : ''}
    </p>
  )
}
