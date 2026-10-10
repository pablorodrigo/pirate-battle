import { Button } from '../../shared/ui/Button.tsx'
import styles from './Leaderboards.module.css'

type PaginationProps = {
  label: string
  page: number
  totalPages: number
  disabled: boolean
  onChange: (page: number) => void
}

export function Pagination({ label, page, totalPages, disabled, onChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null
  }
  return (
    <nav className={styles.pagination} aria-label={`${label} pages`}>
      <Button variant="secondary" size="small" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1}>
        Previous
      </Button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="small"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        Next
      </Button>
    </nav>
  )
}
