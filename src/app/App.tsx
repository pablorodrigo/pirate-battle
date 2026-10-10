import { useState } from 'react'
import { defaultMatchSettings } from '../game/config/matchSettings.ts'
import { GameScreen } from '../features/gameplay/GameScreen.tsx'
import { MainMenu } from '../features/menu/MainMenu.tsx'

type Screen = 'menu' | 'game'

export function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const showMenu = () => setScreen('menu')

  if (screen === 'game') {
    return <GameScreen settings={defaultMatchSettings} onFinished={showMenu} onExit={showMenu} />
  }
  return <MainMenu onPlay={() => setScreen('game')} />
}
