import { uiImage } from '../../shared/ui/uiSkin.ts'
import { useTouchDevice } from '../gameplay/useDeviceTraits.ts'
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

/** The on-screen buttons of a match, drawn with the same atlas art. */
const TOUCH_CONTROLS = [
  { action: 'Sail forward', image: uiImage('icon_forward'), button: 'Arrow button, on the left' },
  { action: 'Turn left', image: uiImage('icon_turn_left'), button: 'Turn left button, on the left' },
  { action: 'Turn right', image: uiImage('icon_turn_right'), button: 'Turn right button, on the left' },
  { action: 'Fire from the bow', image: uiImage('icon_fire_front'), button: 'Single shot button, on the right' },
  { action: 'Fire left side cannons', image: uiImage('icon_fire_left'), button: 'Left broadside button, on the right' },
  { action: 'Fire right side cannons', image: uiImage('icon_fire_right'), button: 'Right broadside button, on the right' },
  { action: 'Pause', image: uiImage('icon_pause'), button: 'Pause button, at the top right' },
]

const frame = uiImage('button_round_normal')

/** Explains the controls of the device in use: the on-screen buttons on touch screens, keys elsewhere. */
export function ControlsGuide() {
  const touch = useTouchDevice()

  return (
    <section className={styles.guide} aria-labelledby="controls-title" data-controls={touch ? 'touch' : 'keyboard'}>
      <h2 id="controls-title" className={styles.title}>
        How to play
      </h2>
      <p className={styles.goal}>
        Sink enemy ships before time runs out. Each ship sunk by your cannons scores a point; Chasers explode
        when they ram you.
      </p>
      {touch ? (
        <>
          <p className={styles.goal}>
            The buttons on the left sail and turn, and those on the right fire. Hold several at once to move and fire
            together.
          </p>
          <dl className={styles.controls}>
            {TOUCH_CONTROLS.map(({ action, image, button }) => (
              <div key={action} className={styles.control}>
                <dt>{action}</dt>
                <dd>
                  <TouchButtonIcon image={image} label={button} />
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
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
      )}
    </section>
  )
}

function TouchButtonIcon({ image, label }: { image: { src: string; srcSet: string }; label: string }) {
  return (
    <span className={styles.button} role="img" aria-label={label}>
      <img className={styles.frame} src={frame.src} srcSet={frame.srcSet} alt="" draggable={false} />
      <img className={styles.icon} src={image.src} srcSet={image.srcSet} alt="" draggable={false} />
    </span>
  )
}
