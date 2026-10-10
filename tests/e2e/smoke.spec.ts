import { expect, test } from '../support/fixtures.ts'

test('opens on the main menu', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Pirate Battle')
  await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
})

test('reaches the mock API through Axios and TanStack Query', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('status').filter({ hasText: 'Mock API' })).toHaveText('Mock API: online')
})

test('mounts one WebGL canvas per visit and removes it on exit', async ({ page }) => {
  await page.goto('/')

  for (let visit = 1; visit <= 3; visit += 1) {
    await page.getByRole('button', { name: 'Play' }).click()
    const gameCanvas = page.getByTestId('game-canvas')
    await expect(gameCanvas).toHaveAttribute('data-state', 'ready')
    await expect(gameCanvas).toHaveAttribute('data-renderer', 'webgl')
    await expect(page.locator('canvas')).toHaveCount(1)

    await page.getByRole('button', { name: 'Pause' }).click()
    await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
  }
})
