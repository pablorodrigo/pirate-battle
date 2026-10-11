import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'
import { finishQuietMatch, startMatch } from '../support/match.ts'

/** The WCAG 2.1 A and AA rules: contrast, labels, names, focus and the structure of each screen. */
const WCAG_RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Every rule the screen breaks, with how many elements break it, so a failure reads at a glance. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_RULES).analyze()
  return results.violations.map((violation) => `${violation.id} (${violation.nodes.length}): ${violation.help}`)
}

test('the main menu passes the WCAG 2.1 AA checks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('tabpanel', { name: 'Ranking' }).getByRole('table')).toBeVisible()
  expect(await violations(page)).toEqual([])

  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Match History' })).toBeVisible()
  expect(await violations(page)).toEqual([])
})

test('the options screen passes the WCAG 2.1 AA checks', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Options' })).toBeVisible()
  expect(await violations(page)).toEqual([])
})

test('a paused match passes the WCAG 2.1 AA checks', async ({ page }) => {
  await startMatch(page, { spawns: false })
  await page.keyboard.press('KeyP')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  expect(await violations(page)).toEqual([])
})

test('the result screen passes the WCAG 2.1 AA checks', async ({ page }) => {
  await finishQuietMatch(page)
  await expect(page.getByTestId('registration-status')).toHaveAttribute('data-status', 'confirmed')
  expect(await violations(page)).toEqual([])
})
