import { expect, test } from '../support/fixtures.ts'
import { expectGameReady, finishQuietMatch } from '../support/match.ts'

const status = (page: import('@playwright/test').Page) => page.getByTestId('registration-status')

test('registers a finished match once and shows it in both tabs', async ({ page }) => {
  await finishQuietMatch(page)
  await expect(status(page)).toHaveAttribute('data-status', 'confirmed')
  await expect(status(page)).toContainText('Saved to the ranking')

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Ranking' }).getByRole('row', { name: /\(you\)/ })).toHaveCount(1)
  await page.getByRole('tab', { name: 'Match History' }).click()
  const history = page.getByRole('tabpanel', { name: 'Match History' })
  await expect(history.getByRole('row')).toHaveCount(2)
  await expect(history.getByRole('row').nth(1)).toContainText('Time ran out')
})

test('shows the same result after a reload', async ({ page }) => {
  await finishQuietMatch(page)
  await expect(status(page)).toHaveAttribute('data-status', 'confirmed')

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: "Time's up!" })).toBeVisible()
  await expect(page.getByTestId('result-score')).toHaveText('0')
  await expect(page.getByTestId('result-time')).toHaveText('2:00')
  await expect(page.getByTestId('result-reason')).toHaveText('Time ran out')
  await expect(status(page)).toHaveAttribute('data-status', 'confirmed')

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
})

test('keeps a pending registration through a reload and sends it once the server is back', async ({
  page,
  consoleErrors,
}) => {
  consoleErrors.allow(/Failed to load resource/)
  await finishQuietMatch(page, '/?scenario=unavailable')
  await expect(status(page)).toHaveAttribute('data-status', 'waiting')
  await expect(status(page)).toContainText('It will be sent again automatically')

  // Another match can start while the registration is pending.
  await page.getByRole('button', { name: 'Play Again' }).click()
  await expectGameReady(page)
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()

  await page.reload()
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Match History' }).getByRole('alert')).toBeVisible({
    timeout: 15_000,
  })

  // The server comes back: the pending registration is sent on load.
  await page.goto('/?scenario=success')
  await page.getByRole('tab', { name: 'Match History' }).click()
  const history = page.getByRole('tabpanel', { name: 'Match History' })
  await expect(history.getByRole('row')).toHaveCount(2)
})

test('does not duplicate a match the server saved before its answer timed out', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/Failed to load resource/)
  await finishQuietMatch(page, '/?scenario=commit-then-timeout')
  await expect(status(page)).toHaveAttribute('data-status', 'waiting', { timeout: 10_000 })
  await expect(status(page)).toContainText('took too long')

  // Answers come back again; every resend finds the match already saved.
  await page.goto('/?scenario=success')
  await expect(status(page)).toHaveAttribute('data-status', 'confirmed')
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Match History' }).getByRole('row')).toHaveCount(2)
})
