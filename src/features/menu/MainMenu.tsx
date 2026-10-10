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
      <h1 className={styles.title}>Pirate Battle</h1>
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
    </main>
  )
}
