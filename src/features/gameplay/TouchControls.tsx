import { useRef, useState, type PointerEvent } from 'react'
import buttonPressed from '../../../assets/png/default/ui/controls/button_round_pressed.png'
import buttonNormal from '../../../assets/png/default/ui/controls/button_round_normal.png'
import iconFireFront from '../../../assets/png/default/ui/controls/icon_fire_front.png'
import iconFireLeft from '../../../assets/png/default/ui/controls/icon_fire_left.png'
import iconFireRight from '../../../assets/png/default/ui/controls/icon_fire_right.png'
import iconForward from '../../../assets/png/default/ui/controls/icon_forward.png'
import iconTurnLeft from '../../../assets/png/default/ui/controls/icon_turn_left.png'
import iconTurnRight from '../../../assets/png/default/ui/controls/icon_turn_right.png'
import buttonPressed2x from '../../../assets/png/retina/ui/controls/button_round_pressed.png'
import buttonNormal2x from '../../../assets/png/retina/ui/controls/button_round_normal.png'
import iconFireFront2x from '../../../assets/png/retina/ui/controls/icon_fire_front.png'
import iconFireLeft2x from '../../../assets/png/retina/ui/controls/icon_fire_left.png'
import iconFireRight2x from '../../../assets/png/retina/ui/controls/icon_fire_right.png'
import iconForward2x from '../../../assets/png/retina/ui/controls/icon_forward.png'
import iconTurnLeft2x from '../../../assets/png/retina/ui/controls/icon_turn_left.png'
import iconTurnRight2x from '../../../assets/png/retina/ui/controls/icon_turn_right.png'
import type { GameAction, InputManager } from '../../game/input/InputManager.ts'
import styles from './TouchControls.module.css'
import type { ScreenLayout } from './useDeviceTraits.ts'

type ControlButton = {
  readonly action: GameAction
  readonly label: string
  readonly icon: readonly [string, string]
  /** Grid area inside the cluster: the main action sits on top, flanked below. */
  readonly area: 'top' | 'left' | 'right'
}

const MOVEMENT: readonly ControlButton[] = [
  { action: 'turnLeft', label: 'Turn left', icon: [iconTurnLeft, iconTurnLeft2x], area: 'left' },
  { action: 'thrust', label: 'Sail forward', icon: [iconForward, iconForward2x], area: 'top' },
  { action: 'turnRight', label: 'Turn right', icon: [iconTurnRight, iconTurnRight2x], area: 'right' },
]

const ATTACKS: readonly ControlButton[] = [
  { action: 'fireLeft', label: 'Fire left side cannons', icon: [iconFireLeft, iconFireLeft2x], area: 'left' },
  { action: 'fireFront', label: 'Fire from the bow', icon: [iconFireFront, iconFireFront2x], area: 'top' },
  { action: 'fireRight', label: 'Fire right side cannons', icon: [iconFireRight, iconFireRight2x], area: 'right' },
]

const srcSet = ([oneX, twoX]: readonly [string, string]) => `${oneX} 1x, ${twoX} 2x`

type TouchControlsProps = {
  input: InputManager | null
  group: 'movement' | 'attacks'
  layout: ScreenLayout
}

/** One cluster of on-screen controls; each finger holds its own action. */
export function TouchControls({ input, group, layout }: TouchControlsProps) {
  const buttons = group === 'movement' ? MOVEMENT : ATTACKS
  return (
    <div
      className={styles.cluster}
      role="group"
      aria-label={group === 'movement' ? 'Movement' : 'Cannons'}
      data-layout={layout}
    >
      {buttons.map((button) => (
        <TouchButton key={button.action} button={button} input={input} />
      ))}
    </div>
  )
}

/**
 * Pointer Events with capture: the action stays held while the finger that
 * pressed it is down, even if it slides off, and lifting or cancelling one
 * finger never releases an action another finger holds.
 */
function TouchButton({ button, input }: { button: ControlButton; input: InputManager | null }) {
  const pointers = useRef(new Set<number>())
  const [pressed, setPressed] = useState(false)

  function press(event: PointerEvent<HTMLButtonElement>): void {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.add(event.pointerId)
    input?.press(button.action, `pointer:${event.pointerId}`)
    setPressed(true)
  }

  function release(event: PointerEvent<HTMLButtonElement>): void {
    if (!pointers.current.delete(event.pointerId)) {
      return
    }
    input?.release(button.action, `pointer:${event.pointerId}`)
    setPressed(pointers.current.size > 0)
  }

  return (
    <button
      type="button"
      // Keyboard players use their keys; these buttons are for touch.
      tabIndex={-1}
      aria-label={button.label}
      className={styles.button}
      data-area={button.area}
      data-pressed={pressed}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <img
        className={styles.frame}
        src={pressed ? buttonPressed : buttonNormal}
        srcSet={srcSet(pressed ? [buttonPressed, buttonPressed2x] : [buttonNormal, buttonNormal2x])}
        alt=""
        draggable={false}
      />
      <img className={styles.icon} src={button.icon[0]} srcSet={srcSet(button.icon)} alt="" draggable={false} />
    </button>
  )
}
