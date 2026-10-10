import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { CompletedMatch, EndReason } from '../../shared/contracts/matches.ts'
import { formatClock } from '../gameplay/formatTime.ts'
import { matchJournal } from '../registration/matchJournal.ts'
import type { RegistrationStatus } from '../registration/RegistrationCoordinator.ts'
import { useRegistration, useRegistrationStatus } from '../registration/registrationContext.ts'
import styles from './ResultScreen.module.css'

type ResultScreenProps = {
  match: CompletedMatch
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

function registrationText(status: RegistrationStatus): string {
  switch (status.kind) {
    case 'confirmed':
      return 'Saved to the ranking and your match history.'
    case 'sending':
      return 'Saving to the ranking…'
    case 'waiting':
      return `Not saved yet: ${status.message} It will be sent again automatically.`
    case 'failed':
      return `Not saved: ${status.message}`
  }
}

export function ResultScreen({ match, onPlayAgain, onMainMenu }: ResultScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const registration = useRegistration()
  const status = useRegistrationStatus(match.matchId)
  const persisted = useSyncExternalStore(matchJournal.subscribe, () => matchJournal.getState().persisted)

  // Move focus to the new screen so keyboard and screen reader users land on the outcome.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <main className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {HEADLINES[match.endReason]}
      </h1>
      <dl className={styles.summary}>
        <div className={styles.row}>
          <dt>Score</dt>
          <dd data-testid="result-score">{match.score}</dd>
        </div>
        <div className={styles.row}>
          <dt>Time played</dt>
          <dd data-testid="result-time">{formatClock(match.durationMs / 1000)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Reason</dt>
          <dd data-testid="result-reason">{REASONS[match.endReason]}</dd>
        </div>
      </dl>
      <div className={styles.registration} data-testid="registration-status" data-status={status.kind}>
        <p role="status">{registrationText(status)}</p>
        {status.kind !== 'confirmed' && status.kind !== 'sending' && (
          <button type="button" onClick={() => registration.retry(match.matchId)}>
            Try again
          </button>
        )}
        {!persisted && (
          <p role="alert">This browser could not store the match, so it will be lost if the page reloads.</p>
        )}
      </div>
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
