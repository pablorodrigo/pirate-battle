import { useEffect, useRef } from 'react'
import type { PauseReason } from '../../game/core/GameSession.ts'
import styles from './PauseDialog.module.css'

type PauseDialogProps = {
  reason: PauseReason | null
  onResume: () => void
  onExit: () => void
}

const REASON_TEXT: Readonly<Record<PauseReason, string>> = {
  manual: 'The match is paused.',
  blur: 'The match paused because the window lost focus.',
  hidden: 'The match paused because the tab was hidden.',
}

/**
 * Modal pause menu. The native modal dialog traps focus, makes the page
 * behind it inert and restores focus when it closes.
 */
export function PauseDialog({ reason, onResume, onExit }: PauseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => {
      dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="pause-title"
      aria-describedby="pause-reason"
      onCancel={(event) => {
        // Escape resumes instead of just closing the dialog.
        event.preventDefault()
        onResume()
      }}
    >
      <h2 id="pause-title" className={styles.title}>
        Paused
      </h2>
      <p id="pause-reason">{REASON_TEXT[reason ?? 'manual']}</p>
      <div className={styles.actions}>
        {/* showModal() focuses the first button, so Resume gets focus. */}
        <button type="button" onClick={onResume}>
          Resume
        </button>
        <button type="button" onClick={onExit}>
          Main Menu
        </button>
      </div>
    </dialog>
  )
}
