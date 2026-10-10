import { useEffect, useRef } from 'react'
import type { PauseReason } from '../../game/core/GameSession.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Checkbox } from '../../shared/ui/Checkbox.tsx'
import panelStyles from '../../shared/ui/Panel.module.css'
import { saveSoundEnabled, useSoundEnabled } from '../options/soundStore.ts'
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
  const soundEnabled = useSoundEnabled()

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
      className={`${panelStyles.panel} ${styles.dialog}`}
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
        {/* Resuming plays the match's own sound. */}
        <Button sound={null} onClick={onResume}>
          Resume
        </Button>
        <Button variant="secondary" sound="back" onClick={onExit}>
          Main Menu
        </Button>
      </div>
      {/* Applies at once, and also to later matches. */}
      <div className={styles.settings}>
        <Checkbox checked={soundEnabled} onChange={saveSoundEnabled}>
          Sound effects
        </Checkbox>
      </div>
    </dialog>
  )
}
