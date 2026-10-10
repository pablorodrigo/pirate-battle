import { expect, test } from '../support/fixtures.ts'

test('opens on the main menu', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Pirate Battle')
  await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
})
