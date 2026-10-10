import type { HudSnapshot } from '../../game/runtime/GameRuntime.ts'
import { formatClock } from './formatTime.ts'
import styles from './Hud.module.css'

type HudProps = {
  hud: HudSnapshot | null
  onPause: () => void
}

/** Semantic match status: the canvas draws the same values for sighted players. */
export function Hud({ hud, onPause }: HudProps) {
  return (
    <header className={styles.hud}>
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Score</dt>
          <dd data-testid="hud-score">{hud?.score ?? 0}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Time</dt>
          <dd data-testid="hud-time">{formatClock(hud?.remainingSeconds ?? 0)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Health</dt>
          <dd data-testid="hud-health">
            <meter
              className={styles.meter}
              min={0}
              max={hud?.maxHealth ?? 100}
              low={(hud?.maxHealth ?? 100) / 3}
              high={((hud?.maxHealth ?? 100) * 2) / 3}
              optimum={hud?.maxHealth ?? 100}
              value={hud?.health ?? 0}
              aria-label="Health"
            />
            <span>{hud?.health ?? 0}</span>
          </dd>
        </div>
      </dl>
      <button type="button" onClick={onPause} disabled={hud?.status !== 'running'}>
        Pause
      </button>
    </header>
  )
}
