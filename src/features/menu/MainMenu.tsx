import styles from './MainMenu.module.css'

type MainMenuProps = {
  onPlay: () => void
}

export function MainMenu({ onPlay }: MainMenuProps) {
  return (
    <main className={styles.menu}>
      <h1 className={styles.title}>Pirate Battle</h1>
      <button type="button" className={styles.play} onClick={onPlay}>
        Play
      </button>
    </main>
  )
}
