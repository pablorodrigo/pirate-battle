import { useId, useRef, useState, type KeyboardEvent } from 'react'
import buttonStyles from '../../shared/ui/Button.module.css'
import { HistoryPanel } from './HistoryPanel.tsx'
import styles from './Leaderboards.module.css'
import { RankingPanel } from './RankingPanel.tsx'

const TABS = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match History' },
] as const

type TabId = (typeof TABS)[number]['id']

/**
 * WAI-ARIA tabs: arrow keys, Home and End move between tabs. Only the
 * selected panel is mounted, so its list refreshes every time it is shown.
 */
export function LeaderboardTabs() {
  const [selected, setSelected] = useState<TabId>('ranking')
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>())
  const baseId = useId()
  const tabId = (id: TabId) => `${baseId}-${id}-tab`
  const panelId = (id: TabId) => `${baseId}-${id}-panel`

  function select(index: number): void {
    const tab = TABS[(index + TABS.length) % TABS.length]
    if (tab) {
      setSelected(tab.id)
      tabRefs.current.get(tab.id)?.focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const current = TABS.findIndex((tab) => tab.id === selected)
    const moves: Record<string, number> = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: TABS.length - 1 }
    const next = moves[event.key]
    if (next !== undefined) {
      event.preventDefault()
      select(next)
    }
  }

  return (
    <section className={styles.leaderboards} aria-label="Leaderboards">
      <div role="tablist" aria-label="Leaderboards" className={styles.tablist}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) {
                tabRefs.current.set(tab.id, element)
              } else {
                tabRefs.current.delete(tab.id)
              }
            }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={selected === tab.id}
            aria-controls={panelId(tab.id)}
            tabIndex={selected === tab.id ? 0 : -1}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small} ${styles.tab}`}
            onClick={() => setSelected(tab.id)}
            onKeyDown={handleKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId(selected)} aria-labelledby={tabId(selected)} tabIndex={0}>
        {selected === 'ranking' ? <RankingPanel /> : <HistoryPanel />}
      </div>
    </section>
  )
}
