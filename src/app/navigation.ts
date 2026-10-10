import type { MatchSettings } from '../game/config/matchSettings.ts'
import type { MatchResult } from '../game/core/GameSession.ts'

export type Screen =
  | { readonly name: 'menu' }
  /** `attempt` changes on every new match, so the game screen always remounts fresh. */
  | { readonly name: 'game'; readonly attempt: number; readonly settings: MatchSettings }
  | { readonly name: 'result'; readonly result: MatchResult; readonly settings: MatchSettings }

export type NavigationAction =
  | { readonly type: 'play'; readonly settings: MatchSettings }
  | { readonly type: 'finish'; readonly result: MatchResult }
  | { readonly type: 'showMenu' }

export type NavigationState = {
  readonly screen: Screen
  readonly attempts: number
}

export const initialNavigation: NavigationState = { screen: { name: 'menu' }, attempts: 0 }

export function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'play': {
      const attempts = state.attempts + 1
      return { attempts, screen: { name: 'game', attempt: attempts, settings: action.settings } }
    }
    case 'finish':
      // A late result from a match the player already left is ignored.
      if (state.screen.name !== 'game') {
        return state
      }
      return { ...state, screen: { name: 'result', result: action.result, settings: state.screen.settings } }
    case 'showMenu':
      return { ...state, screen: { name: 'menu' } }
  }
}
