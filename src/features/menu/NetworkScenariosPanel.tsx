import { useQueryClient } from '@tanstack/react-query'
import { useId, useSyncExternalStore } from 'react'
import { mockServer } from '../../mocks/mockServer.ts'
import { isNetworkScenario, NETWORK_SCENARIOS, type NetworkScenario } from '../../mocks/networkScenarios.ts'
import { revisionGuard } from '../../shared/api/revisionGuard.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { matchQueryKeys } from '../leaderboards/queries.ts'
import { getPlayer } from '../player/playerIdentity.ts'
import { matchJournal } from '../registration/matchJournal.ts'
import { useRegistration } from '../registration/registrationContext.ts'
import styles from './NetworkScenariosPanel.module.css'

const SCENARIO_NAMES = Object.keys(NETWORK_SCENARIOS) as NetworkScenario[]

/**
 * Demo controls for the mock API: pick how the ranking and history server
 * behaves, or restore the initial data. The game never depends on it.
 */
export function NetworkScenariosPanel() {
  const queryClient = useQueryClient()
  const registration = useRegistration()
  const scenario = useSyncExternalStore(mockServer.subscribe, mockServer.getScenario)
  const pending = useSyncExternalStore(matchJournal.subscribe, () => matchJournal.getState().outbox.length)
  const selectId = useId()
  const descriptionId = useId()

  function select(next: NetworkScenario): void {
    // A data scenario restarts the server's revisions; every list reloads under the new behavior.
    revisionGuard.reset()
    mockServer.selectScenario(next, getPlayer())
    void queryClient.invalidateQueries({ queryKey: matchQueryKeys.ranking })
    void queryClient.invalidateQueries({ queryKey: matchQueryKeys.history })
  }

  async function reset(): Promise<void> {
    // Nothing started before the reset may land in the restored data.
    await queryClient.cancelQueries()
    registration.reset()
    matchJournal.clear()
    revisionGuard.reset()
    mockServer.resetDemoData()
    await queryClient.resetQueries()
  }

  return (
    <details className={styles.panel}>
      <summary>Network scenarios</summary>
      <div className={styles.body}>
        <p className={styles.note}>
          Simulates how the ranking and match history server behaves. Playing never depends on it. You can also
          open the game with <code>?scenario=name</code>.
        </p>
        <label htmlFor={selectId}>Scenario</label>
        <select
          id={selectId}
          value={scenario}
          aria-describedby={descriptionId}
          onChange={(event) => {
            if (isNetworkScenario(event.target.value)) {
              select(event.target.value)
            }
          }}
        >
          {SCENARIO_NAMES.map((name) => (
            <option key={name} value={name}>
              {NETWORK_SCENARIOS[name].label}
            </option>
          ))}
        </select>
        <p id={descriptionId} className={styles.note}>
          {NETWORK_SCENARIOS[scenario].description}
        </p>
        <p role="status" data-testid="pending-registrations">
          Pending registrations: {pending}
        </p>
        <Button variant="secondary" onClick={() => void reset()}>
          Reset demo data
        </Button>
        <p className={styles.note}>
          Restores the sample captains and the Success scenario, and removes the matches and pending registrations
          of this browser.
        </p>
      </div>
    </details>
  )
}
