import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  size?: 'large' | 'small'
}

/** Menu button drawn with the asset pack's button art, sized from the UI atlas. */
export function Button({ variant = 'primary', size = 'large', className, type = 'button', ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...props} />
}
