import backdrop from '../../shared/ui/Backdrop.module.css'
import { Button } from '../../shared/ui/Button.tsx'
import { Panel } from '../../shared/ui/Panel.tsx'
import { uiImage } from '../../shared/ui/uiSkin.ts'
import { LeaderboardTabs } from '../leaderboards/LeaderboardTabs.tsx'
import { getPlayer } from '../player/playerIdentity.ts'
import { ApiStatus } from './ApiStatus.tsx'
import { ControlsGuide } from './ControlsGuide.tsx'
import styles from './MainMenu.module.css'
import { NetworkScenariosPanel } from './NetworkScenariosPanel.tsx'

const MOCKS_ENABLED = import.meta.env.VITE_ENABLE_MOCKS !== 'false'
const title = uiImage('title_pirate_battle')

type MainMenuProps = {
  onPlay: () => void
  onOptions: () => void
}

export function MainMenu({ onPlay, onOptions }: MainMenuProps) {
  return (
    <main className={`${backdrop.backdrop} ${styles.menu}`}>
      <Panel className={styles.mainPanel}>
        <h1 className={styles.title}>
          <img
            className={styles.titleImage}
            src={title.src}
            srcSet={title.srcSet}
            width={title.width}
            height={title.height}
            alt="Pirate Battle"
          />
        </h1>
        <p className={styles.tagline}>Set sail. Take command.</p>
        <p className={styles.captain}>
          Sailing as <strong>{getPlayer().name}</strong>
        </p>
        <nav className={styles.actions} aria-label="Main menu">
          <Button onClick={onPlay}>Play</Button>
          <Button sound="open" onClick={onOptions}>
            Options
          </Button>
        </nav>
        <ControlsGuide />
        <ApiStatus />
      </Panel>
      <Panel className={styles.boardPanel}>
        <LeaderboardTabs />
        {MOCKS_ENABLED && <NetworkScenariosPanel />}
      </Panel>
    </main>
  )
}
