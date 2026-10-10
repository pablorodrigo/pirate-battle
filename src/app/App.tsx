import { useReducer } from 'react'
import { GameScreen } from '../features/gameplay/GameScreen.tsx'
import { MainMenu } from '../features/menu/MainMenu.tsx'
import { OptionsScreen } from '../features/options/OptionsScreen.tsx'
import { getSettings } from '../features/options/settingsStore.ts'
import { ResultScreen } from '../features/results/ResultScreen.tsx'
import { initialNavigation, navigationReducer } from './navigation.ts'

export function App() {
  const [{ screen }, dispatch] = useReducer(navigationReducer, initialNavigation)
  const showMenu = () => dispatch({ type: 'showMenu' })
  // Each match runs on the settings saved when it starts.
  const play = () => dispatch({ type: 'play', settings: getSettings() })

  switch (screen.name) {
    case 'game':
      return (
        <GameScreen
          key={screen.attempt}
          settings={screen.settings}
          onFinished={(result) => dispatch({ type: 'finish', result })}
          onExit={showMenu}
        />
      )
    case 'result':
      return <ResultScreen result={screen.result} onPlayAgain={play} onMainMenu={showMenu} />
    case 'options':
      return <OptionsScreen onBack={showMenu} />
    case 'menu':
      return <MainMenu onPlay={play} onOptions={() => dispatch({ type: 'showOptions' })} />
  }
}
