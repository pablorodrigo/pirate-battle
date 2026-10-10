import { useReducer } from 'react'
import { createMatchConfig, rulesetIdOf, type MatchSettings } from '../game/config/matchSettings.ts'
import type { MatchResult } from '../game/core/GameSession.ts'
import { GameScreen } from '../features/gameplay/GameScreen.tsx'
import { MainMenu } from '../features/menu/MainMenu.tsx'
import { OptionsScreen } from '../features/options/OptionsScreen.tsx'
import { getSettings } from '../features/options/settingsStore.ts'
import { getPlayer } from '../features/player/playerIdentity.ts'
import { matchJournal } from '../features/registration/matchJournal.ts'
import { useRegistration } from '../features/registration/registrationContext.ts'
import { ResultScreen } from '../features/results/ResultScreen.tsx'
import type { CompletedMatch } from '../shared/contracts/matches.ts'
import { createId } from '../shared/ids.ts'
import { navigationReducer, restoredNavigation } from './navigation.ts'

function completedMatch(matchId: string, settings: MatchSettings, result: MatchResult): CompletedMatch {
  const config = createMatchConfig(settings)
  const player = getPlayer()
  return {
    matchId,
    playerId: player.id,
    playerName: player.name,
    completedAt: new Date().toISOString(),
    score: result.score,
    durationMs: result.activeDurationMs,
    endReason: result.endReason,
    rulesetId: rulesetIdOf(config),
    config: {
      rulesVersion: config.rulesVersion,
      matchDurationSeconds: config.matchDurationSeconds,
      spawnIntervalSeconds: config.spawn.intervalSeconds,
    },
  }
}

export function App() {
  const registration = useRegistration()
  const [{ screen }, dispatch] = useReducer(navigationReducer, undefined, () => {
    const { lastResult, showResultOnLoad } = matchJournal.getState()
    return restoredNavigation(lastResult, showResultOnLoad)
  })

  const showMenu = () => {
    matchJournal.dismissResult()
    dispatch({ type: 'showMenu' })
  }
  // Each match gets a new id and runs on the settings saved when it starts.
  const play = () => {
    matchJournal.dismissResult()
    dispatch({ type: 'play', matchId: createId(), settings: getSettings() })
  }

  switch (screen.name) {
    case 'game':
      return (
        <GameScreen
          key={screen.attempt}
          settings={screen.settings}
          onFinished={(result) => {
            // The result is stored with its pending registration before any request is sent.
            const match = completedMatch(screen.matchId, screen.settings, result)
            matchJournal.recordCompleted(match)
            registration.sendPending()
            dispatch({ type: 'finish', match })
          }}
          onExit={showMenu}
        />
      )
    case 'result':
      return <ResultScreen match={screen.match} onPlayAgain={play} onMainMenu={showMenu} />
    case 'options':
      return <OptionsScreen onBack={showMenu} />
    case 'menu':
      return <MainMenu onPlay={play} onOptions={() => dispatch({ type: 'showOptions' })} />
  }
}
