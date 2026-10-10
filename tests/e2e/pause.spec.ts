import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'
import { expectGameReady } from '../support/match.ts'

async function startMatch(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expectGameReady(page)
}

test('pauses from the keyboard, freezes the clock and resumes only on request', async ({ page }) => {
  await startMatch(page)
  const clock = page.getByTestId('hud-time')
  await expect(clock).not.toHaveText('2:00')

  await page.keyboard.press('KeyP')
  const dialog = page.getByRole('dialog', { name: 'Paused' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Resume' })).toBeFocused()
  const pausedAt = (await clock.textContent()) ?? ''
  await page.waitForTimeout(1500)
  await expect(clock).toHaveText(pausedAt)

  await dialog.getByRole('button', { name: 'Resume' }).click()
  await expect(dialog).toBeHidden()
  await expect(clock).not.toHaveText(pausedAt, { timeout: 3000 })
})

test('pauses automatically when the window loses focus', async ({ page }) => {
  await startMatch(page)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))

  const dialog = page.getByRole('dialog', { name: 'Paused' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('the window lost focus')
})
