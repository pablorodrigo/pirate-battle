import { useState } from 'react'
import { GameScreen } from '../features/gameplay/GameScreen.tsx'
import { MainMenu } from '../features/menu/MainMenu.tsx'

type Screen = 'menu' | 'game'

export function App() {
  const [screen, setScreen] = useState<Screen>('menu')

  if (screen === 'game') {
    return <GameScreen onExit={() => setScreen('menu')} />
  }
  return <MainMenu onPlay={() => setScreen('game')} />
}
