import { expect, test } from '../support/fixtures.ts'

test('shows loading progress before the match starts', async ({ page, context }) => {
  await context.route('**/tiles_sheet*.png', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()

  await expect(page.getByRole('progressbar', { name: 'Loading the fleet…' })).toBeVisible()
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'loading')
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'ready')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
})

test('reports a failed asset, keeps combat stopped and recovers on retry', async ({ page, context, consoleErrors }) => {
  consoleErrors.allow(/Failed to load resource/)
  await context.route('**/ships_miscellaneous_sheet*.png', (route) => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('could not be loaded')
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'error')
  await expect(page.getByTestId('hud-time')).toHaveText('0:00')
  await expect(page.locator('canvas')).toHaveCount(0)

  await context.unroute('**/ships_miscellaneous_sheet*.png')
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('leaves to the main menu from a failed load', async ({ page, context, consoleErrors }) => {
  consoleErrors.allow(/Failed to load resource/)
  await context.route('**/ships_miscellaneous_sheet*.png', (route) => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()

  await page.getByRole('alert').getByRole('button', { name: 'Main Menu' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
})
