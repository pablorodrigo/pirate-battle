import type { HTMLAttributes } from 'react'
import styles from './Panel.module.css'

/**
 * Framed panel: the UI atlas's nine-slice panel art, with content kept inside
 * the content area its metadata defines.
 */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={[styles.panel, className].filter(Boolean).join(' ')} {...props} />
}
