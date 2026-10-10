import type { BrowserContext } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'
import { expectGameReady } from '../support/match.ts'

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

/** The menus' sounds are the pack's `ui_` files; every other file belongs to a match. */
const isInterfaceSound = (path: string) => /\/ui_/.test(path)

test('loads the menu sounds at the first press and the match sounds once a match starts', async ({ page, context }) => {
  const files = soundRequests(context)
  const loaded = (interfaceSounds: boolean) => [...files].filter((path) => isInterfaceSound(path) === interfaceSounds)
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'Mock API' })).toHaveText('Mock API: online')
  expect(files.size).toBe(0)

  await page.getByRole('button', { name: 'Options' }).click()
  await expect.poll(() => loaded(true).length).toBe(4)
  await page.getByRole('button', { name: 'Main Menu' }).click()
  expect(loaded(false)).toEqual([])

  await page.getByRole('button', { name: 'Play' }).click()
  await expectGameReady(page)
  await expect.poll(() => loaded(false).length).toBe(22)
})

test('downloads no sound while sound effects are off', async ({ page, context }) => {
  const files = soundRequests(context)
  await page.addInitScript(() => {
    window.localStorage.setItem('pirate-battle:sound', JSON.stringify({ version: 1, data: { enabled: false } }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expectGameReady(page)
  // Absence can only be checked over time: long enough for every file to have been requested.
  await page.waitForTimeout(1500)
  expect(files.size).toBe(0)
})
