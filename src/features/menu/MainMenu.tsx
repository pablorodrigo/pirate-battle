import { LeaderboardTabs } from '../leaderboards/LeaderboardTabs.tsx'
import { getPlayer } from '../player/playerIdentity.ts'
import { ApiStatus } from './ApiStatus.tsx'
import { ControlsGuide } from './ControlsGuide.tsx'
import styles from './MainMenu.module.css'

type MainMenuProps = {
  onPlay: () => void
  onOptions: () => void
}

export function MainMenu({ onPlay, onOptions }: MainMenuProps) {
  return (
    <main className={styles.menu}>
      <header className={styles.header}>
        <h1 className={styles.title}>Pirate Battle</h1>
        <p className={styles.captain}>
          Sailing as <strong>{getPlayer().name}</strong>
        </p>
      </header>
      <div className={styles.columns}>
        <div className={styles.column}>
          <nav className={styles.actions} aria-label="Main menu">
            <button type="button" className={styles.primary} onClick={onPlay}>
              Play
            </button>
            <button type="button" onClick={onOptions}>
              Options
            </button>
          </nav>
          <ControlsGuide />
          <ApiStatus />
        </div>
        <LeaderboardTabs />
      </div>
    </main>
  )
}
