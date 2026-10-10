import { useEffect, useRef, useState } from 'react'
import { defaultArena } from '../../game/config/defaultArena.ts'
import { PixiRenderer } from '../../game/rendering/PixiRenderer.ts'
import styles from './GameCanvas.module.css'

type CanvasStatus =
  | { state: 'loading' }
  | { state: 'ready'; renderer: string }
  | { state: 'error' }

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<CanvasStatus>({ state: 'loading' })

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }
    const renderer = new PixiRenderer(defaultArena)
    let active = true
    renderer.mount(host).then(
      () => {
        if (active) {
          setStatus({ state: 'ready', renderer: renderer.rendererName })
        }
      },
      (error: unknown) => {
        if (active) {
          console.error('The game renderer failed to start.', error)
          setStatus({ state: 'error' })
        }
      },
    )
    return () => {
      active = false
      renderer.destroy()
    }
  }, [])

  return (
    <div
      className={styles.frame}
      data-testid="game-canvas"
      data-state={status.state}
      data-renderer={status.state === 'ready' ? status.renderer : undefined}
    >
      <div ref={hostRef} className={styles.host} />
      {status.state === 'loading' && <p className={styles.message}>Loading…</p>}
      {status.state === 'error' && (
        <p className={styles.message} role="alert">
          The game could not start.
        </p>
      )}
    </div>
  )
}
