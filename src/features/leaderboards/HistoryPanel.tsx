import { useState } from 'react'
import { getPlayer } from '../player/playerIdentity.ts'
import { END_REASON_LABELS, formatDate, formatDuration } from './format.ts'
import styles from './Leaderboards.module.css'
import { ListStatus } from './ListStatus.tsx'
import { Pagination } from './Pagination.tsx'
import { useHistoryPage } from './queries.ts'

/** The local captain's registered matches, newest first. */
export function HistoryPanel() {
  const player = getPlayer()
  const [page, setPage] = useState(1)
  const query = useHistoryPage(player.id, page)
  const data = query.data

  return (
    <div className={styles.panel}>
      <ListStatus
        noun="match history"
        isPending={query.isPending}
        isFetching={query.isFetching}
        hasData={data !== undefined}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {data?.totalItems === 0 && (
        <p className={styles.empty}>You have no registered matches yet. Finish a match to see it here.</p>
      )}
      {data && data.items.length > 0 && (
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>
            Match history, page {data.page} of {data.totalPages}
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Score</th>
              <th scope="col">Time played</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((match) => (
              <tr key={match.matchId}>
                <td>{formatDate(match.completedAt)}</td>
                <td>{match.score}</td>
                <td>{formatDuration(match.durationMs)}</td>
                <td>{END_REASON_LABELS[match.endReason]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination
        label="Match history"
        page={page}
        totalPages={data?.totalPages ?? 0}
        disabled={query.isPlaceholderData}
        onChange={setPage}
      />
    </div>
  )
}
