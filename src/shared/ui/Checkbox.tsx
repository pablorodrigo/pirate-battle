import type { ReactNode } from 'react'
import styles from './Checkbox.module.css'

type CheckboxProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}

/** A native checkbox inside its label, at least 44 px tall for touch. */
export function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  )
}
