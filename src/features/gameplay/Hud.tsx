import type { CSSProperties } from 'react'
import type { HudSnapshot } from '../../game/runtime/GameRuntime.ts'
import { formatClock } from './formatTime.ts'
import styles from './Hud.module.css'
import type { ScreenLayout } from './useDeviceTraits.ts'

type HudProps = {
  hud: HudSnapshot | null
  layout: ScreenLayout
  onPause: () => void
}

function healthColor(ratio: number): 'green' | 'amber' | 'red' {
  return ratio > 2 / 3 ? 'green' : ratio > 1 / 3 ? 'amber' : 'red'
}

/**
 * Semantic match status drawn with the HUD art: the term of each value is
 * kept for assistive technology, while icons carry it visually. Its three
 * parts (health, counters, pause) sit in one row, or, in the landscape touch
 * layout, in the game screen's side columns.
 */
export function Hud({ hud, layout, onPause }: HudProps) {
  const health = hud?.health ?? 0
  const maxHealth = hud?.maxHealth ?? 100
  const ratio = maxHealth > 0 ? health / maxHealth : 0

  return (
    <header className={styles.hud} data-layout={layout}>
      <dl className={styles.healthPanel}>
        <div className={styles.health}>
          <dt className={styles.visuallyHidden}>Health</dt>
          <dd data-testid="hud-health" className={styles.healthValue}>
            <meter
              className={styles.visuallyHidden}
              min={0}
              max={maxHealth}
              low={maxHealth / 3}
              high={(maxHealth * 2) / 3}
              optimum={maxHealth}
              value={health}
              aria-label="Health"
            />
            <span className={styles.healthIcon} aria-hidden="true" />
            <span
              className={styles.healthBar}
              data-color={healthColor(ratio)}
              style={{ '--ratio': ratio } as CSSProperties}
              aria-hidden="true"
            >
              <span className={styles.healthFill} />
            </span>
            <span className={styles.healthText}>
              {health} / {maxHealth}
            </span>
          </dd>
        </div>
      </dl>
      <dl className={styles.counters}>
        <div className={styles.counter}>
          <dt className={styles.visuallyHidden}>Score</dt>
          <span className={styles.scoreIcon} aria-hidden="true" />
          <dd data-testid="hud-score">{hud?.score ?? 0}</dd>
        </div>
        <div className={styles.counter}>
          <dt className={styles.visuallyHidden}>Time</dt>
          <span className={styles.timeIcon} aria-hidden="true" />
          <dd data-testid="hud-time">{formatClock(hud?.remainingSeconds ?? 0)}</dd>
        </div>
      </dl>
      <button
        type="button"
        className={styles.pause}
        onClick={onPause}
        disabled={hud?.status !== 'running'}
        aria-label="Pause"
      >
        <span className={styles.pauseIcon} aria-hidden="true" />
      </button>
    </header>
  )
}
