import { useRef } from 'react'
import type { MatchSettings } from '../../game/config/matchSettings.ts'
import type { MatchResult } from '../../game/core/GameSession.ts'
import type { HudSnapshot } from '../../game/runtime/GameRuntime.ts'
import styles from './GameScreen.module.css'
import { Hud } from './Hud.tsx'
import { PauseDialog } from './PauseDialog.tsx'
import { useGameRuntime } from './useGameRuntime.ts'
import { useMatchHud } from './useMatchHud.ts'

type GameScreenProps = {
  settings: MatchSettings
  onFinished: (result: MatchResult) => void
  onExit: () => void
}

export function GameScreen({ settings, onFinished, onExit }: GameScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const runtimeState = useGameRuntime(hostRef, settings, onFinished)
  const runtime = runtimeState.status === 'ready' ? runtimeState.runtime : null
  const hud = useMatchHud(runtime)

  return (
    <main className={styles.screen}>
      <h1 className={styles.visuallyHidden}>Battle</h1>
      <Hud hud={hud} onPause={() => runtime?.pause('manual')} />
      <div
        className={styles.arena}
        data-testid="game-canvas"
        data-state={runtimeState.status}
        data-renderer={runtimeState.status === 'ready' ? runtimeState.rendererName : undefined}
      >
        <div ref={hostRef} className={styles.host} role="img" aria-label="Battle arena" />
        {runtimeState.status === 'loading' && <p className={styles.message}>Loading…</p>}
        {runtimeState.status === 'error' && (
          <p className={styles.message} role="alert">
            The game could not start.
          </p>
        )}
      </div>
      <p className={styles.visuallyHidden} role="status">
        {announcementFor(hud)}
      </p>
      {hud?.status === 'paused' && (
        <PauseDialog reason={hud.pauseReason} onResume={() => runtime?.resume()} onExit={onExit} />
      )}
    </main>
  )
}

/** Only state changes are announced; the clock and score are never read out on their own. */
function announcementFor(hud: HudSnapshot | null): string {
  if (hud?.status === 'paused') {
    return 'Game paused.'
  }
  if (hud?.status === 'finished') {
    return 'Match over.'
  }
  return ''
}
