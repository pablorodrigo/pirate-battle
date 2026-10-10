import { useCallback, useEffect, useEffectEvent, useState, type RefObject } from 'react'
import { loadGameTextures } from '../../game/assets/gameTextures.ts'
import { MatchSounds } from '../../game/audio/MatchSounds.ts'
import { soundBank } from '../../game/audio/SoundBank.ts'
import { defaultArena } from '../../game/config/defaultArena.ts'
import { createMatchConfig, type MatchSettings } from '../../game/config/matchSettings.ts'
import { GameSession, type MatchResult } from '../../game/core/GameSession.ts'
import { PixiRenderer } from '../../game/rendering/PixiRenderer.ts'
import { createSeed, GameRuntime } from '../../game/runtime/GameRuntime.ts'
import { applyScenario } from '../../game/runtime/scenario.ts'
import { testHooks } from '../../game/runtime/testHooks.ts'

export type GameRuntimeState =
  | { readonly status: 'loading'; readonly progress: number }
  | { readonly status: 'ready'; readonly runtime: GameRuntime; readonly rendererName: string }
  | { readonly status: 'error' }

/**
 * Loads the match textures (shared across matches), then creates the match,
 * the renderer, its sounds and the runtime for one visit of the game screen
 * and releases all of them when the screen unmounts. A match never survives
 * leaving the screen, and combat only starts once every required resource is
 * ready. Sounds are not required: they load in the background.
 */
export function useGameRuntime(
  hostRef: RefObject<HTMLDivElement | null>,
  settings: MatchSettings,
  onFinished: (result: MatchResult) => void,
): { readonly state: GameRuntimeState; readonly retry: () => void } {
  const [state, setState] = useState<GameRuntimeState>({ status: 'loading', progress: 0 })
  const [attempt, setAttempt] = useState(0)
  const handleFinished = useEffectEvent(onFinished)

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }
    let active = true
    let renderer: PixiRenderer | null = null
    let runtime: GameRuntime | null = null
    let sounds: MatchSounds | null = null
    let stopSounds: (() => void) | null = null
    const hooks = testHooks.current

    const start = async (): Promise<void> => {
      // Parallel downloads can still report progress after the load failed;
      // those reports must not replace the error with an endless spinner.
      let loadSettled = false
      const textures = await loadGameTextures((progress) => {
        if (active && !loadSettled) {
          setState({ status: 'loading', progress })
        }
      }).finally(() => {
        loadSettled = true
      })
      if (!active) {
        return
      }
      const scenario = hooks?.scenario() ?? {}
      const config = createMatchConfig(settings)
      const session = new GameSession(config, defaultArena, scenario.seed ?? createSeed(), {
        spawnsEnabled: scenario.spawns ?? true,
      })
      applyScenario(session, scenario, config)
      const view = new PixiRenderer(defaultArena, textures)
      const matchSounds = new MatchSounds(soundBank)
      const match = new GameRuntime({
        session,
        // Each frame's events reach the sounds right after the renderer.
        view: {
          onFrame: (callback) => view.onFrame(callback),
          render: (world, alpha, events) => {
            view.render(world, alpha, events)
            matchSounds.handleEvents(events)
          },
        },
        onFinished: (result) => handleFinished(result),
        manualClock: scenario.manualClock ?? false,
      })
      renderer = view
      runtime = match
      sounds = matchSounds
      await view.mount(host)
      if (!active) {
        return
      }
      matchSounds.handleHud(match.getHudSnapshot())
      stopSounds = match.subscribe(() => matchSounds.handleHud(match.getHudSnapshot()))
      match.start()
      hooks?.attach(match)
      setState({ status: 'ready', runtime: match, rendererName: view.rendererName })
    }

    start().catch((error: unknown) => {
      if (active) {
        console.warn('The game could not start.', error)
        setState({ status: 'error' })
      }
    })

    return () => {
      active = false
      stopSounds?.()
      sounds?.dispose()
      if (runtime) {
        hooks?.detach(runtime)
        runtime.dispose()
      }
      renderer?.destroy()
    }
  }, [hostRef, settings, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', progress: 0 })
    setAttempt((value) => value + 1)
  }, [])

  return { state, retry }
}
