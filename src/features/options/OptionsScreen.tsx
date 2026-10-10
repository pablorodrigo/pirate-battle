import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import {
  defaultMatchSettings,
  MATCH_DURATION_LIMITS,
  SPAWN_INTERVAL_LIMITS,
  validateMatchSettings,
  type MatchSettingsErrors,
} from '../../game/config/matchSettings.ts'
import backdrop from '../../shared/ui/Backdrop.module.css'
import { Button } from '../../shared/ui/Button.tsx'
import { Checkbox } from '../../shared/ui/Checkbox.tsx'
import { Panel } from '../../shared/ui/Panel.tsx'
import styles from './OptionsScreen.module.css'
import { saveSettings, useSettings } from './settingsStore.ts'
import { saveSoundEnabled, useSoundEnabled } from './soundStore.ts'

type OptionsScreenProps = {
  onBack: () => void
}

type SaveStatus = 'idle' | 'saved' | 'unsaved'

export function OptionsScreen({ onBack }: OptionsScreenProps) {
  const settings = useSettings()
  const soundEnabled = useSoundEnabled()
  const [duration, setDuration] = useState(String(settings.matchDurationSeconds))
  const [spawnInterval, setSpawnInterval] = useState(String(settings.spawnIntervalSeconds))
  const [sound, setSound] = useState(soundEnabled)
  const [errors, setErrors] = useState<MatchSettingsErrors>({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const durationRef = useRef<HTMLInputElement>(null)
  const spawnRef = useRef<HTMLInputElement>(null)
  const ids = { duration: useId(), spawn: useId() }

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const candidate = {
      matchDurationSeconds: parseNumber(duration),
      spawnIntervalSeconds: parseNumber(spawnInterval),
    }
    const found = validateMatchSettings(candidate)
    setErrors(found)
    if (found.matchDurationSeconds || found.spawnIntervalSeconds) {
      setSaveStatus('idle')
      ;(found.matchDurationSeconds ? durationRef : spawnRef).current?.focus()
      return
    }
    const settingsStored = saveSettings(candidate)
    const soundStored = saveSoundEnabled(sound)
    setSaveStatus(settingsStored && soundStored ? 'saved' : 'unsaved')
  }

  function restoreDefaults(): void {
    setDuration(String(defaultMatchSettings.matchDurationSeconds))
    setSpawnInterval(String(defaultMatchSettings.spawnIntervalSeconds))
    setSound(true)
    setErrors({})
    setSaveStatus('idle')
  }

  return (
    <main className={`${backdrop.backdrop} ${styles.screen}`}>
      <Panel className={styles.panel}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          Options
        </h1>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <NumberField
            id={ids.duration}
            inputRef={durationRef}
            label="Game session time"
            unit="seconds"
            hint={`Whole seconds from ${MATCH_DURATION_LIMITS.min} to ${MATCH_DURATION_LIMITS.max}.`}
            value={duration}
            limits={MATCH_DURATION_LIMITS}
            error={errors.matchDurationSeconds}
            onChange={setDuration}
          />
          <NumberField
            id={ids.spawn}
            inputRef={spawnRef}
            label="Enemy spawn time"
            unit="seconds"
            hint={`From ${SPAWN_INTERVAL_LIMITS.min} to ${SPAWN_INTERVAL_LIMITS.max} seconds, in steps of ${SPAWN_INTERVAL_LIMITS.step}. Lower is harder.`}
            value={spawnInterval}
            limits={SPAWN_INTERVAL_LIMITS}
            error={errors.spawnIntervalSeconds}
            onChange={setSpawnInterval}
          />
          <Checkbox checked={sound} onChange={setSound}>
            Play sound effects
          </Checkbox>
          <p className={styles.status} role="status">
            {saveStatus === 'saved' && 'Settings saved. They apply to your next match.'}
            {saveStatus === 'unsaved' &&
              'Settings apply to your next match, but this browser could not store them.'}
          </p>
          <div className={styles.actions}>
            <Button type="submit">Save</Button>
            <Button variant="secondary" onClick={restoreDefaults}>
              Restore defaults
            </Button>
            <Button variant="secondary" sound="close" onClick={onBack}>
              Main Menu
            </Button>
          </div>
        </form>
      </Panel>
    </main>
  )
}

type NumberFieldProps = {
  id: string
  inputRef: RefObject<HTMLInputElement | null>
  label: string
  unit: string
  hint: string
  value: string
  limits: { readonly min: number; readonly max: number; readonly step: number }
  error: string | undefined
  onChange: (value: string) => void
}

function NumberField({ id, inputRef, label, unit, hint, value, limits, error, onChange }: NumberFieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          id={id}
          type="number"
          inputMode="decimal"
          min={limits.min}
          max={limits.max}
          step={limits.step}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>{unit}</span>
      </div>
      <p id={hintId} className={styles.hint}>
        {hint}
      </p>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

function parseNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}
