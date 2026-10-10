import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { CompletedMatch, EndReason } from '../../shared/contracts/matches.ts'
import backdrop from '../../shared/ui/Backdrop.module.css'
import { Button } from '../../shared/ui/Button.tsx'
import { Panel } from '../../shared/ui/Panel.tsx'
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
    <main className={`${backdrop.backdrop} ${styles.screen}`}>
      <Panel className={styles.panel}>
        {/* On short landscape screens the outcome takes the left column; see the stylesheet. */}
        <div className={styles.outcome}>
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
        </div>
        <div className={styles.next}>
          <div className={styles.registration} data-testid="registration-status" data-status={status.kind}>
            <p role="status">{registrationText(status)}</p>
            {status.kind !== 'confirmed' && status.kind !== 'sending' && (
              <Button variant="secondary" size="small" onClick={() => registration.retry(match.matchId)}>
                Try again
              </Button>
            )}
            {!persisted && (
              <p role="alert">This browser could not store the match, so it will be lost if the page reloads.</p>
            )}
          </div>
          <div className={styles.actions}>
            <Button onClick={onPlayAgain}>Play Again</Button>
            <Button variant="secondary" sound="back" onClick={onMainMenu}>
              Main Menu
            </Button>
          </div>
        </div>
      </Panel>
    </main>
  )
}
