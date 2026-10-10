import { useEffect, useRef } from 'react'
import type { EndReason } from '../../game/core/events.ts'
import type { MatchResult } from '../../game/core/GameSession.ts'
import { formatClock } from '../gameplay/formatTime.ts'
import styles from './ResultScreen.module.css'

type ResultScreenProps = {
  result: MatchResult
  onPlayAgain: () => void
  onMainMenu: () => void
}

const HEADLINES: Readonly<Record<EndReason, string>> = {
  timeout: "Time's up!",
  death: 'Your ship sank',
}

const REASONS: Readonly<Record<EndReason, string>> = {
  timeout: 'Time ran out',
  death: 'Ship destroyed',
}

export function ResultScreen({ result, onPlayAgain, onMainMenu }: ResultScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the new screen so keyboard and screen reader users land on the outcome.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <main className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {HEADLINES[result.endReason]}
      </h1>
      <dl className={styles.summary}>
        <div className={styles.row}>
          <dt>Score</dt>
          <dd data-testid="result-score">{result.score}</dd>
        </div>
        <div className={styles.row}>
          <dt>Time played</dt>
          <dd data-testid="result-time">{formatClock(result.activeDurationMs / 1000)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Reason</dt>
          <dd data-testid="result-reason">{REASONS[result.endReason]}</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <button type="button" onClick={onPlayAgain}>
          Play Again
        </button>
        <button type="button" onClick={onMainMenu}>
          Main Menu
        </button>
      </div>
    </main>
  )
}
