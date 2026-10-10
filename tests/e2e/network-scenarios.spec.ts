import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'
import { finishQuietMatch } from '../support/match.ts'

async function selectScenario(page: Page, label: string): Promise<void> {
  const select = page.getByLabel('Scenario')
  if (!(await select.isVisible())) {
    await page.locator('summary', { hasText: 'Network scenarios' }).click()
  }
  await select.selectOption({ label })
}

const ranking = (page: Page) => page.getByRole('tabpanel', { name: 'Ranking' })
const history = (page: Page) => page.getByRole('tabpanel', { name: 'Match History' })
const pending = (page: Page) => page.getByTestId('pending-registrations')

test('switches scenarios at runtime and the lists follow', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/status of 500/)
  await page.goto('/')
  await selectScenario(page, 'History fails')
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(history(page).getByRole('alert')).toBeVisible({ timeout: 15_000 })

  await selectScenario(page, 'Success')
  await expect(history(page)).toContainText('no registered matches yet')
})

test('never retries client errors and retries server errors twice', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/status of (400|503)/)
  // Answered reads only: Strict Mode in development cancels the first read of a remounted list.
  let rankingReads = 0
  page.on('response', (response) => {
    if (response.url().includes('/api/ranking')) {
      rankingReads += 1
    }
  })

  await page.goto('/?scenario=http-4xx')
  await expect(ranking(page).getByRole('alert')).toContainText('HTTP 400')
  await page.waitForTimeout(3500)
  expect(rankingReads).toBe(1)

  rankingReads = 0
  await page.goto('/?scenario=http-5xx')
  await expect(ranking(page).getByRole('alert')).toContainText('HTTP 503', { timeout: 15_000 })
  expect(rankingReads).toBe(3)
})

test('reset restores the sample data and forgets pending registrations', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/Failed to load resource/)
  await finishQuietMatch(page, '/?scenario=unavailable')
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.locator('summary', { hasText: 'Network scenarios' }).click()
  await expect(pending(page)).toHaveText('Pending registrations: 1')

  await page.getByRole('button', { name: 'Reset demo data' }).click()
  await expect(pending(page)).toHaveText('Pending registrations: 0')
  await expect(page.getByLabel('Scenario')).toHaveValue('success')
  await expect(ranking(page).getByRole('row')).toHaveCount(9)
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(history(page)).toContainText('no registered matches yet')
})

test('sends pending registrations as soon as the server comes back', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/Failed to load resource/)
  await finishQuietMatch(page, '/?scenario=unavailable')
  await expect(page.getByTestId('registration-status')).toHaveAttribute('data-status', 'waiting')
  await page.getByRole('button', { name: 'Main Menu' }).click()

  await selectScenario(page, 'Success')
  await expect(pending(page)).toHaveText('Pending registrations: 0')
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(history(page).getByRole('row')).toHaveCount(2)
})

test('resends a registration that timed out unsaved and stores it once', async ({ page }) => {
  await finishQuietMatch(page, '/?scenario=timeout')
  const status = page.getByTestId('registration-status')
  await expect(status).toHaveAttribute('data-status', 'waiting', { timeout: 10_000 })
  await expect(status).toContainText('took too long')

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await selectScenario(page, 'Success')
  await expect(pending(page)).toHaveText('Pending registrations: 0')
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(history(page).getByRole('row')).toHaveCount(2)
})

test('keeps the newest lists when responses arrive out of order', async ({ page }) => {
  await finishQuietMatch(page, '/?scenario=out-of-order')
  await expect(page.getByTestId('registration-status')).toHaveAttribute('data-status', 'confirmed')
  await page.getByRole('button', { name: 'Main Menu' }).click()

  const mine = ranking(page).getByRole('row', { name: /\(you\)/ })
  await expect(mine).toHaveCount(1, { timeout: 10_000 })
  // Slow, older answers land later and must not replace the newer list.
  await page.waitForTimeout(2500)
  await expect(mine).toHaveCount(1)

  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(history(page).getByRole('row')).toHaveCount(2, { timeout: 10_000 })
  await page.waitForTimeout(2500)
  await expect(history(page).getByRole('row')).toHaveCount(2)
})
