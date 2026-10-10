import { expect, test } from '../support/fixtures.ts'
import { expectGameReady } from '../support/match.ts'

test('validates, saves and restores the options after a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Options' })).toBeFocused()

  const duration = page.getByLabel('Game session time')
  const spawn = page.getByLabel('Enemy spawn time')
  await expect(duration).toHaveValue('120')
  await expect(spawn).toHaveValue('2.5')

  await duration.fill('59')
  await spawn.fill('0.3')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(duration).toHaveAttribute('aria-invalid', 'true')
  await expect(duration).toBeFocused()
  await expect(duration).toHaveAccessibleDescription(/between 60 and 180/)
  await expect(spawn).toHaveAccessibleDescription(/between 1 and 10 seconds/)

  await duration.fill('90')
  await spawn.fill('4')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Settings saved' })).toBeVisible()
  await expect(duration).not.toHaveAttribute('aria-invalid')

  await page.reload()
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(page.getByLabel('Game session time')).toHaveValue('90')
  await expect(page.getByLabel('Enemy spawn time')).toHaveValue('4')
})

test('starts the next match with the saved options', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Options' }).click()
  await page.getByLabel('Game session time').fill('75')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Main Menu' }).click()

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByTestId('hud-time')).toHaveText(/^1:1[0-5]$/)
})

test('restores the default values', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Options' }).click()
  await page.getByLabel('Game session time').fill('150')
  await page.getByRole('checkbox', { name: 'Play sound effects' }).uncheck()
  await page.getByRole('button', { name: 'Restore defaults' }).click()
  await expect(page.getByLabel('Game session time')).toHaveValue('120')
  await expect(page.getByRole('checkbox', { name: 'Play sound effects' })).toBeChecked()
})

test('turns sound effects off in Options, back on while paused, and keeps the choice', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Options' }).click()
  const optionsSound = page.getByRole('checkbox', { name: 'Play sound effects' })
  await expect(optionsSound).toBeChecked()
  await optionsSound.uncheck()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Settings saved' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Play' }).click()
  await expectGameReady(page)
  await page.getByRole('button', { name: 'Pause' }).click()
  const pauseMenu = page.getByRole('dialog', { name: 'Paused' })
  const pauseSound = pauseMenu.getByRole('checkbox', { name: 'Sound effects' })
  await expect(pauseSound).not.toBeChecked()
  await pauseSound.check()
  await pauseMenu.getByRole('button', { name: 'Main Menu' }).click()

  await page.reload()
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(page.getByRole('checkbox', { name: 'Play sound effects' })).toBeChecked()
})
