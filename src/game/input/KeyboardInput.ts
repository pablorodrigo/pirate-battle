import type { GameAction, InputManager } from './InputManager.ts'

/** Physical key positions (KeyboardEvent.code), so other layouts keep the same places. */
const KEY_ACTIONS: Readonly<Record<string, GameAction>> = {
  KeyW: 'thrust',
  ArrowUp: 'thrust',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
}

const PAUSE_KEYS: ReadonlySet<string> = new Set(['KeyP', 'Escape'])

export type KeyboardInputOptions = {
  readonly input: InputManager
  /** Game keys are only captured while this returns true (the match is running). */
  readonly isCapturing: () => boolean
  readonly onPauseKey: () => void
}

/**
 * Translates keyboard events into game actions. Keys typed into form fields
 * are never captured, and game keys are left alone outside active play, so
 * menus and dialogs keep their normal keyboard behavior.
 */
export class KeyboardInput {
  private readonly options: KeyboardInputOptions

  constructor(options: KeyboardInputOptions) {
    this.options = options
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown, { capture: true })
    window.addEventListener('keyup', this.onKeyUp, { capture: true })
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown, { capture: true })
    window.removeEventListener('keyup', this.onKeyUp, { capture: true })
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) {
      return
    }
    if (PAUSE_KEYS.has(event.code)) {
      event.preventDefault()
      if (!event.repeat) {
        this.options.onPauseKey()
      }
      return
    }
    const action = KEY_ACTIONS[event.code]
    if (!action || !this.options.isCapturing()) {
      return
    }
    event.preventDefault()
    // Auto-repeat never presses an action: a key held since before a pause
    // has to be released and pressed again to act after resuming.
    if (!event.repeat) {
      this.options.input.press(action, `key:${event.code}`)
    }
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_ACTIONS[event.code]
    if (action) {
      this.options.input.release(action, `key:${event.code}`)
    }
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
