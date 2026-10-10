import { useState } from 'react'
import { createMatchConfig, rulesetIdOf } from '../../game/config/matchSettings.ts'
import { useSettings } from '../options/settingsStore.ts'
import { getPlayer } from '../player/playerIdentity.ts'
import { formatDate, formatDuration } from './format.ts'
import styles from './Leaderboards.module.css'
import { ListStatus } from './ListStatus.tsx'
import { Pagination } from './Pagination.tsx'
import { useRankingPage } from './queries.ts'

/** Ranks only matches played with the current Options, so every row is comparable. */
export function RankingPanel() {
  const settings = useSettings()
  const rulesetId = rulesetIdOf(createMatchConfig(settings))
  const player = getPlayer()
  const [page, setPage] = useState(1)
  const query = useRankingPage(rulesetId, page)
  const data = query.data

  return (
    <div className={styles.panel}>
      <p className={styles.caption}>
        Matches of {settings.matchDurationSeconds} s with an enemy every {settings.spawnIntervalSeconds} s. Ties go
        to the longest survival, then the earliest match.
      </p>
      <ListStatus
        noun="ranking"
        isPending={query.isPending}
        isFetching={query.isFetching}
        hasData={data !== undefined}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {data?.totalItems === 0 && <p className={styles.empty}>No matches with these settings yet. Be the first!</p>}
      {data && data.items.length > 0 && (
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>
            Ranking, page {data.page} of {data.totalPages}
          </caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Captain</th>
              <th scope="col">Score</th>
              <th scope="col">Time</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((entry) => {
              const mine = entry.playerId === player.id
              return (
                <tr key={entry.matchId} className={mine ? styles.mine : undefined}>
                  <td>{entry.rank}</td>
                  <td>
                    {entry.playerName}
                    {mine && <span className={styles.badge}> (you)</span>}
                  </td>
                  <td>{entry.score}</td>
                  <td>{formatDuration(entry.durationMs)}</td>
                  <td>{formatDate(entry.completedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <Pagination
        label="Ranking"
        page={page}
        totalPages={data?.totalPages ?? 0}
        disabled={query.isPlaceholderData}
        onChange={setPage}
      />
    </div>
  )
}
