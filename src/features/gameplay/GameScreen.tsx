import { useRef, type CSSProperties } from 'react'
import { defaultArena } from '../../game/config/defaultArena.ts'
import type { MatchSettings } from '../../game/config/matchSettings.ts'
import type { MatchResult } from '../../game/core/GameSession.ts'
import type { HudSnapshot } from '../../game/runtime/GameRuntime.ts'
import { Button } from '../../shared/ui/Button.tsx'
import styles from './GameScreen.module.css'
import { Hud } from './Hud.tsx'
import { PauseDialog } from './PauseDialog.tsx'
import { TouchControls } from './TouchControls.tsx'
import { useScreenLayout } from './useDeviceTraits.ts'
import { useGameRuntime } from './useGameRuntime.ts'
import { useMatchHud } from './useMatchHud.ts'
import { useNoPageZoom } from './useNoPageZoom.ts'

/** Lets the portrait layout size the arena's box to the arena itself. */
const ARENA_ASPECT = { '--arena-aspect': `${defaultArena.width} / ${defaultArena.height}` } as CSSProperties

type GameScreenProps = {
  settings: MatchSettings
  onFinished: (result: MatchResult) => void
  onExit: () => void
}

export function GameScreen({ settings, onFinished, onExit }: GameScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { state, retry } = useGameRuntime(hostRef, settings, onFinished)
  const runtime = state.status === 'ready' ? state.runtime : null
  const hud = useMatchHud(runtime)
  const layout = useScreenLayout()
  const touch = layout !== 'keyboard'
  useNoPageZoom()

  return (
    <main className={styles.screen} data-layout={layout} style={ARENA_ASPECT}>
      <h1 className={styles.visuallyHidden}>Battle</h1>
      <Hud hud={hud} layout={layout} onPause={() => runtime?.pause('manual')} />
      {touch && (
        <div className={styles.movement}>
          <TouchControls input={runtime?.input ?? null} group="movement" layout={layout} />
        </div>
      )}
      <div
        className={styles.arena}
        data-testid="game-canvas"
        data-state={state.status}
        data-renderer={state.status === 'ready' ? state.rendererName : undefined}
      >
        <div ref={hostRef} className={styles.host} role="img" aria-label="Battle arena" />
        {state.status === 'loading' && (
          <div className={styles.overlay}>
            <p id="loading-label">Loading the fleet…</p>
            <progress aria-labelledby="loading-label" max={100} value={Math.round(state.progress * 100)} />
          </div>
        )}
        {state.status === 'error' && (
          <div className={styles.overlay} role="alert">
            <p>The game assets could not be loaded. Check your connection and try again.</p>
            <div className={styles.actions}>
              <Button onClick={retry}>Retry</Button>
              <Button variant="secondary" onClick={onExit}>
                Main Menu
              </Button>
            </div>
          </div>
        )}
      </div>
      {touch && (
        <div className={styles.attacks}>
          <TouchControls input={runtime?.input ?? null} group="attacks" layout={layout} />
        </div>
      )}
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
