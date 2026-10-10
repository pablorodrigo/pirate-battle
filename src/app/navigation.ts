import type { MatchSettings } from '../game/config/matchSettings.ts'
import type { CompletedMatch } from '../shared/contracts/matches.ts'

export type Screen =
  | { readonly name: 'menu' }
  | { readonly name: 'options' }
  /** `attempt` changes on every new match, so the game screen always remounts fresh. */
  | { readonly name: 'game'; readonly attempt: number; readonly matchId: string; readonly settings: MatchSettings }
  | { readonly name: 'result'; readonly match: CompletedMatch }

export type NavigationAction =
  /** Carries the id and the settings snapshot of the new match. */
  | { readonly type: 'play'; readonly matchId: string; readonly settings: MatchSettings }
  | { readonly type: 'finish'; readonly match: CompletedMatch }
  | { readonly type: 'showMenu' }
  | { readonly type: 'showOptions' }

export type NavigationState = {
  readonly screen: Screen
  readonly attempts: number
}

export const initialNavigation: NavigationState = { screen: { name: 'menu' }, attempts: 0 }

/** Reopens the last result after a reload when the player was looking at it. */
export function restoredNavigation(lastResult: CompletedMatch | null, showResult: boolean): NavigationState {
  return lastResult && showResult ? { screen: { name: 'result', match: lastResult }, attempts: 0 } : initialNavigation
}

export function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'play': {
      const attempts = state.attempts + 1
      return {
        attempts,
        screen: { name: 'game', attempt: attempts, matchId: action.matchId, settings: action.settings },
      }
    }
    case 'finish':
      // A late result from a match the player already left is ignored.
      if (state.screen.name !== 'game' || state.screen.matchId !== action.match.matchId) {
        return state
      }
      return { ...state, screen: { name: 'result', match: action.match } }
    case 'showMenu':
      return { ...state, screen: { name: 'menu' } }
    case 'showOptions':
      return { ...state, screen: { name: 'options' } }
  }
}
