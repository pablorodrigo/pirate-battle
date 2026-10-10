import { useReducer } from 'react'
import { defaultMatchSettings } from '../game/config/matchSettings.ts'
import { GameScreen } from '../features/gameplay/GameScreen.tsx'
import { MainMenu } from '../features/menu/MainMenu.tsx'
import { ResultScreen } from '../features/results/ResultScreen.tsx'
import { initialNavigation, navigationReducer } from './navigation.ts'

export function App() {
  const [{ screen }, dispatch] = useReducer(navigationReducer, initialNavigation)
  const showMenu = () => dispatch({ type: 'showMenu' })

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
      return (
        <ResultScreen
          result={screen.result}
          onPlayAgain={() => dispatch({ type: 'play', settings: screen.settings })}
          onMainMenu={showMenu}
        />
      )
    case 'menu':
      return <MainMenu onPlay={() => dispatch({ type: 'play', settings: defaultMatchSettings })} />
  }
}
