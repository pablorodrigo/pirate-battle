import type { BrowserContext } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'

/** Sound files the game downloads, from the page or through the mock API's service worker. */
function soundRequests(context: BrowserContext): Set<string> {
  const files = new Set<string>()
  context.on('request', (request) => {
    const url = new URL(request.url())
    // The dev server also serves each `import` of a sound as a tiny module, marked with `?import`.
    if (url.pathname.endsWith('.wav') && !url.searchParams.has('import')) {
      files.add(url.pathname)
    }
  })
  return files
}

test('loads the sound effects in the background once a match starts', async ({ page, context }) => {
  const files = soundRequests(context)
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'Mock API' })).toHaveText('Mock API: online')
  expect(files.size).toBe(0)

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'ready')
  await expect.poll(() => files.size).toBe(21)
})

test('downloads no sound while sound effects are off', async ({ page, context }) => {
  const files = soundRequests(context)
  await page.addInitScript(() => {
    window.localStorage.setItem('pirate-battle:sound', JSON.stringify({ version: 1, data: { enabled: false } }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'ready')
  // Absence can only be checked over time: long enough for every file to have been requested.
  await page.waitForTimeout(1500)
  expect(files.size).toBe(0)
})
