import type { InputSnapshot } from '../core/input.ts'

export type GameAction = 'thrust' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight'

/**
 * Merges every input source (keys, touch pointers) into one snapshot. An
 * action stays active while at least one source holds it, so releasing one
 * finger or key never cancels another that still holds the same action.
 */
export class InputManager {
  private readonly holders = new Map<GameAction, Set<string>>()

  press(action: GameAction, sourceId: string): void {
    let sources = this.holders.get(action)
    if (!sources) {
      sources = new Set()
      this.holders.set(action, sources)
    }
    sources.add(sourceId)
  }

  release(action: GameAction, sourceId: string): void {
    this.holders.get(action)?.delete(sourceId)
  }

  /** Releases everything a source holds, e.g. a cancelled pointer. */
  releaseSource(sourceId: string): void {
    for (const sources of this.holders.values()) {
      sources.delete(sourceId)
    }
  }

  clear(): void {
    this.holders.clear()
  }

  isActive(action: GameAction): boolean {
    return (this.holders.get(action)?.size ?? 0) > 0
  }

  snapshot(): InputSnapshot {
    const left = this.isActive('turnLeft')
    const right = this.isActive('turnRight')
    return {
      thrust: this.isActive('thrust'),
      turn: left === right ? 0 : left ? -1 : 1,
      fireFront: this.isActive('fireFront'),
      fireLeft: this.isActive('fireLeft'),
      fireRight: this.isActive('fireRight'),
    }
  }
}
