import { useEffect, useEffectEvent, useState, type RefObject } from 'react'
import { defaultArena } from '../../game/config/defaultArena.ts'
import { createMatchConfig, type MatchSettings } from '../../game/config/matchSettings.ts'
import { GameSession, type MatchResult } from '../../game/core/GameSession.ts'
import { PixiRenderer } from '../../game/rendering/PixiRenderer.ts'
import { createSeed, GameRuntime } from '../../game/runtime/GameRuntime.ts'
import { applyScenario } from '../../game/runtime/scenario.ts'
import { testHooks } from '../../game/runtime/testHooks.ts'

export type GameRuntimeState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly runtime: GameRuntime; readonly rendererName: string }
  | { readonly status: 'error' }

/**
 * Creates the match, the renderer and the runtime for one visit of the game
 * screen, and releases all of them when the screen unmounts. A match never
 * survives leaving the screen.
 */
export function useGameRuntime(
  hostRef: RefObject<HTMLDivElement | null>,
  settings: MatchSettings,
  onFinished: (result: MatchResult) => void,
): GameRuntimeState {
  const [state, setState] = useState<GameRuntimeState>({ status: 'loading' })
  const handleFinished = useEffectEvent(onFinished)

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }
    const hooks = testHooks.current
    const scenario = hooks?.scenario() ?? {}
    const config = createMatchConfig(settings)
    const session = new GameSession(config, defaultArena, scenario.seed ?? createSeed(), {
      spawnsEnabled: scenario.spawns ?? true,
    })
    applyScenario(session, scenario, config)
    const renderer = new PixiRenderer(defaultArena)
    const runtime = new GameRuntime({
      session,
      view: renderer,
      onFinished: (result) => handleFinished(result),
      manualClock: scenario.manualClock ?? false,
    })
    let active = true

    renderer.mount(host).then(
      () => {
        if (active) {
          runtime.start()
          hooks?.attach(runtime)
          setState({ status: 'ready', runtime, rendererName: renderer.rendererName })
        }
      },
      (error: unknown) => {
        if (active) {
          console.error('The game renderer failed to start.', error)
          setState({ status: 'error' })
        }
      },
    )

    return () => {
      active = false
      hooks?.detach(runtime)
      runtime.dispose()
      renderer.destroy()
    }
  }, [hostRef, settings])

  return state
}
