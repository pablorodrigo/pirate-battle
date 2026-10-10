import styles from './ControlsGuide.module.css'

const KEYBOARD_CONTROLS = [
  { action: 'Sail forward', keys: ['W', '↑'] },
  { action: 'Turn left', keys: ['A', '←'] },
  { action: 'Turn right', keys: ['D', '→'] },
  { action: 'Fire from the bow', keys: ['Space'] },
  { action: 'Fire left side cannons', keys: ['Q'] },
  { action: 'Fire right side cannons', keys: ['E'] },
  { action: 'Pause or resume', keys: ['P', 'Esc'] },
] as const

export function ControlsGuide() {
  return (
    <section className={styles.guide} aria-labelledby="controls-title">
      <h2 id="controls-title" className={styles.title}>
        How to play
      </h2>
      <p className={styles.goal}>
        Sink enemy ships before time runs out. Each ship sunk by your cannons scores a point; Chasers explode
        when they ram you.
      </p>
      <dl className={styles.controls}>
        {KEYBOARD_CONTROLS.map(({ action, keys }) => (
          <div key={action} className={styles.control}>
            <dt>{action}</dt>
            <dd>
              {keys.map((key, index) => (
                <span key={key}>
                  {index > 0 && ' or '}
                  <kbd>{key}</kbd>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
