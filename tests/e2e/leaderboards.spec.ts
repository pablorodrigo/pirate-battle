import { expect, test } from '../support/fixtures.ts'
import { expectGameReady } from '../support/match.ts'

test('pages through the ranking of the current settings', async ({ page }) => {
  await page.goto('/?scenario=paginated')
  const ranking = page.getByRole('tabpanel', { name: 'Ranking' })
  const rows = ranking.getByRole('row')

  await expect(ranking.getByText('Page 1 of 5', { exact: true })).toBeVisible()
  await expect(rows).toHaveCount(11)
  await expect(rows.nth(1).getByRole('cell').first()).toHaveText('1')

  await ranking.getByRole('button', { name: 'Next' }).click()
  await expect(ranking.getByText('Page 2 of 5', { exact: true })).toBeVisible()
  await expect(rows.nth(1).getByRole('cell').first()).toHaveText('11')

  await ranking.getByRole('button', { name: 'Previous' }).click()
  await expect(ranking.getByText('Page 1 of 5', { exact: true })).toBeVisible()
})

test('pages through the match history', async ({ page }) => {
  await page.goto('/?scenario=paginated')
  await page.getByRole('tab', { name: 'Match History' }).click()
  const history = page.getByRole('tabpanel', { name: 'Match History' })
  const rows = history.getByRole('row')

  await expect(history.getByText('Page 1 of 3', { exact: true })).toBeVisible()
  await expect(rows).toHaveCount(11)
  await history.getByRole('button', { name: 'Next' }).click()
  await expect(history.getByText('Page 2 of 3', { exact: true })).toBeVisible()
  await history.getByRole('button', { name: 'Next' }).click()
  await expect(history.getByText('Page 3 of 3', { exact: true })).toBeVisible()
  await expect(rows).toHaveCount(4)
  await expect(history.getByRole('button', { name: 'Next' })).toBeDisabled()
})

test('shows empty lists', async ({ page }) => {
  await page.goto('/?scenario=empty')
  await expect(page.getByRole('tabpanel', { name: 'Ranking' })).toContainText('No matches with these settings yet')

  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Match History' })).toContainText('no registered matches yet')
})

test('shows a loading state on a slow network', async ({ page }) => {
  // The load event also waits for the menu's images, which can outlast the
  // slow answer on the dev server, so watching starts as soon as the page commits.
  await page.goto('/?scenario=slow', { waitUntil: 'commit' })
  const ranking = page.getByRole('tabpanel', { name: 'Ranking' })
  await expect(ranking.getByText('Loading ranking…')).toBeVisible()
  await expect(ranking.getByRole('table')).toBeVisible()

  await page.getByRole('tab', { name: 'Match History' }).click()
  const history = page.getByRole('tabpanel', { name: 'Match History' })
  await expect(history.getByText('Loading match history…')).toBeVisible()
  await expect(history).toContainText('no registered matches yet')
})

test('reports a ranking failure without affecting the history or the game', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/status of 500/)
  await page.goto('/?scenario=ranking-error')

  const alert = page.getByRole('tabpanel', { name: 'Ranking' }).getByRole('alert')
  await expect(alert).toContainText('could not be loaded', { timeout: 15_000 })
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()

  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Match History' })).toContainText('no registered matches yet')

  await page.getByRole('button', { name: 'Play' }).click()
  await expectGameReady(page)
})

test('reports a history failure without affecting the ranking or the game', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/status of 500/)
  await page.goto('/?scenario=history-error')
  await expect(page.getByRole('tabpanel', { name: 'Ranking' }).getByRole('table')).toBeVisible()

  await page.getByRole('tab', { name: 'Match History' }).click()
  const alert = page.getByRole('tabpanel', { name: 'Match History' }).getByRole('alert')
  await expect(alert).toContainText('could not be loaded', { timeout: 15_000 })
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()

  await page.getByRole('button', { name: 'Play' }).click()
  await expectGameReady(page)
})

test('moves between tabs with the arrow keys', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Ranking' }).focus()
  await page.keyboard.press('ArrowRight')

  const history = page.getByRole('tab', { name: 'Match History' })
  await expect(history).toBeFocused()
  await expect(history).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Home')
  await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveAttribute('aria-selected', 'true')
})
