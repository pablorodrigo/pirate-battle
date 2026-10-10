/** Player intent for one simulation step, independent of the input device. */
export type InputSnapshot = {
  readonly thrust: boolean
  /** -1 turns counter-clockwise on screen, 1 turns clockwise. */
  readonly turn: -1 | 0 | 1
  readonly fireFront: boolean
  readonly fireLeft: boolean
  readonly fireRight: boolean
}

export const IDLE_INPUT: InputSnapshot = Object.freeze({
  thrust: false,
  turn: 0,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
})
