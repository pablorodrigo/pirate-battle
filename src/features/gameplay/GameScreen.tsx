import { GameCanvas } from './GameCanvas.tsx'
import styles from './GameScreen.module.css'

type GameScreenProps = {
  onExit: () => void
}

export function GameScreen({ onExit }: GameScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.toolbar}>
        <button type="button" onClick={onExit}>
          Main Menu
        </button>
      </header>
      <GameCanvas />
    </main>
  )
}
