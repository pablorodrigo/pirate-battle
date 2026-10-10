import { useRef } from 'react'
import type { MatchSettings } from '../../game/config/matchSettings.ts'
import type { MatchResult } from '../../game/core/GameSession.ts'
import styles from './GameScreen.module.css'
import { useGameRuntime } from './useGameRuntime.ts'

type GameScreenProps = {
  settings: MatchSettings
  onFinished: (result: MatchResult) => void
  onExit: () => void
}

export function GameScreen({ settings, onFinished, onExit }: GameScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const runtimeState = useGameRuntime(hostRef, settings, onFinished)

  return (
    <main className={styles.screen}>
      <header className={styles.toolbar}>
        <button type="button" onClick={onExit}>
          Main Menu
        </button>
      </header>
      <div
        className={styles.arena}
        data-testid="game-canvas"
        data-state={runtimeState.status}
        data-renderer={runtimeState.status === 'ready' ? runtimeState.rendererName : undefined}
      >
        <div ref={hostRef} className={styles.host} />
        {runtimeState.status === 'loading' && <p className={styles.message}>Loading…</p>}
        {runtimeState.status === 'error' && (
          <p className={styles.message} role="alert">
            The game could not start.
          </p>
        )}
      </div>
    </main>
  )
}
