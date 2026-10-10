import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'
import { useInterfaceSound, type InterfaceSound } from './interfaceSound.ts'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  size?: 'large' | 'small'
  /** The sound of a press, or null for a button whose action plays a sound of its own. */
  sound?: InterfaceSound | null
}

/** Menu button drawn with the asset pack's button art, sized from the UI atlas. */
export function Button({
  variant = 'primary',
  size = 'large',
  sound = 'click',
  className,
  type = 'button',
  onClick,
  ...props
}: ButtonProps) {
  const playSound = useInterfaceSound()
  const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')
  return (
    <button
      type={type}
      className={classes}
      onClick={(event) => {
        if (sound) {
          playSound(sound)
        }
        onClick?.(event)
      }}
      {...props}
    />
  )
}
