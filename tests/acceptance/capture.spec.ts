import { devices, type Locator, type Page } from '@playwright/test'
import { defaultGameplayConfig } from '../../src/game/config/defaultConfig.ts'
import { generateMap } from '../../src/game/core/map/generateMap.ts'
import { expect, test } from '../support/fixtures.ts'
import { advance, finishQuietMatch, holdKey, matchState, startMatch, STEPS_PER_SECOND } from '../support/match.ts'

/**
 * Captures the screenshots of docs/ACCEPTANCE.md: `npm run acceptance`.
 * Chromium emulates an iPhone 15 held upright and sideways, at 2× to keep
 * the files light, plus one desktop for the keyboard. The e2e build's
 * read-only bridge sets each scene up: seed, map, ships and a manual clock.
 */
const { defaultBrowserType: _upright, ...iphone } = devices['iPhone 15']
const { defaultBrowserType: _sideways, ...iphoneSideways } = devices['iPhone 15 landscape']
const PORTRAIT = { ...iphone, deviceScaleFactor: 2 }
const LANDSCAPE = { ...iphoneSideways, deviceScaleFactor: 2 }
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }

const OUT = 'docs/acceptance'
/** A fixed captain keeps the menus the same between captures. */
const CAPTAIN = { id: 'player-demo', name: 'Captain Demo' }
/** The drawn map shown in matches: coasts, a fort and a reef. */
const MAP_SEED = 25

async function capture(page: Page, name: string, part?: Locator): Promise<void> {
  const options = { path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 } as const
  await (part ? part.screenshot(options) : page.screenshot(options))
}

async function captureArena(page: Page, name: string, region: Parameters<typeof arenaClip>[1]): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 85, clip: await arenaClip(page, region) })
}

/** Two animation frames, so the canvas shows the last simulated step. */
async function settle(page: Page): Promise<void> {
  for (let frame = 0; frame < 2; frame += 1) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  }
}

/** A region of the arena, in arena units, as a clip of the page around the canvas. */
async function arenaClip(page: Page, region: { x: number; y: number; width: number; height: number }) {
  const box = await page.getByTestId('game-canvas').boundingBox()
  if (!box) {
    throw new Error('The game canvas is not on screen.')
  }
  const scale = Math.min(box.width / 1280, box.height / 720)
  const left = box.x + (box.width - 1280 * scale) / 2
  const top = box.y + (box.height - 720 * scale) / 2
  return { x: left + region.x * scale, y: top + region.y * scale, width: region.width * scale, height: region.height * scale }
}

/** Grows the viewport to the page's height, so a capture holds the whole screen. */
async function wholePage(page: Page): Promise<void> {
  const viewport = page.viewportSize()
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  if (viewport && height > viewport.height) {
    await page.setViewportSize({ width: viewport.width, height })
  }
}

/** Both enemy kinds on open water of the drawn map, facing the player's start. */
function enemiesOnDrawnMap() {
  const { safeSpawnPoints, playerStart } = generateMap(MAP_SEED, defaultGameplayConfig).arena
  return (['chaser', 'shooter'] as const).map((kind, index) => {
    const point = safeSpawnPoints[index] ?? playerStart
    return { kind, x: point.x, y: point.y, angle: Math.atan2(playerStart.y - point.y, playerStart.x - point.x) }
  })
}

/** Sails a little, then fires the bow cannon, so the match is under way. */
async function matchUnderWay(page: Page): Promise<void> {
  await startMatch(page, { seed: MAP_SEED, map: 'generated', spawns: false, enemies: enemiesOnDrawnMap() })
  await holdKey(page, 'KeyW', STEPS_PER_SECOND / 2)
  await page.keyboard.down('Space')
  await advance(page, 8)
  await page.keyboard.up('Space')
  await settle(page)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((captain) => {
    window.localStorage.setItem('pirate-battle:player', JSON.stringify({ version: 1, data: captain }))
  }, CAPTAIN)
})

test.describe('phone held upright', () => {
  test.use(PORTRAIT)

  test('main menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('tabpanel', { name: 'Ranking' }).getByRole('table')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Mock API' })).toHaveText('Mock API: online')
    await wholePage(page)
    await capture(page, 'menu-phone')
  })

  test('options with a rejected value', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByLabel('Game session time').fill('30')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(/between 60 and 180/)).toBeVisible()
    await wholePage(page)
    await capture(page, 'options-phone')
  })

  test('match held upright', async ({ page }) => {
    await matchUnderWay(page)
    await capture(page, 'match-phone-portrait')
  })

  test('ranking and history pages', async ({ page }) => {
    await page.goto('/?scenario=paginated')
    // The framed panel around the tabs, with the pages and the scenarios below them.
    const board = page.locator('section').filter({ has: page.getByRole('tablist') }).first()
    const ranking = page.getByRole('tabpanel', { name: 'Ranking' })
    await expect(ranking.getByText('Page 1 of 5', { exact: true })).toBeVisible()
    await ranking.getByRole('button', { name: 'Next' }).click()
    await expect(ranking.getByText('Page 2 of 5', { exact: true })).toBeVisible()
    await expect(ranking.getByRole('row').nth(1).getByRole('cell').first()).toHaveText('11')
    // A panel taller than the screen is only captured whole once the screen holds the whole page.
    await wholePage(page)
    await capture(page, 'ranking-phone', board)

    await page.getByRole('tab', { name: 'Match History' }).click()
    await expect(page.getByRole('tabpanel', { name: 'Match History' }).getByText('Page 1 of 3', { exact: true })).toBeVisible()
    await wholePage(page)
    await capture(page, 'history-phone', board)
  })

  test('ranking failure and the network scenarios', async ({ page, consoleErrors }) => {
    consoleErrors.allow(/status of 500/)
    await page.goto('/?scenario=ranking-error')
    const board = page.locator('section').filter({ has: page.getByRole('tablist') }).first()
    await expect(page.getByRole('tabpanel', { name: 'Ranking' }).getByRole('alert')).toContainText('could not be loaded', {
      timeout: 15_000,
    })
    await capture(page, 'ranking-error-phone', board)

    await page.getByText('Network scenarios', { exact: true }).click()
    await expect(page.getByRole('button', { name: /reset/i })).toBeVisible()
    await capture(page, 'network-scenarios-phone', page.locator('details'))
  })

  test('result of a sunk ship whose registration waits for the server', async ({ page, consoleErrors }) => {
    consoleErrors.allow(/Failed to load resource|status of 503/)
    await startMatch(
      page,
      {
        spawns: false,
        player: { x: 200, y: 60, angle: 0 },
        enemies: [520, 580, 640, 700, 760].map((x) => ({ kind: 'chaser' as const, x, y: 60, angle: Math.PI })),
      },
      '/?scenario=unavailable',
    )
    await advance(page, STEPS_PER_SECOND * 15)
    await expect(page.getByRole('heading', { level: 1, name: 'Your ship sank' })).toBeVisible()
    await expect(page.getByTestId('registration-status')).toHaveAttribute('data-status', 'waiting', { timeout: 15_000 })
    await capture(page, 'result-sank-phone')
  })
})

test.describe('phone held sideways', () => {
  test.use(LANDSCAPE)

  test('match under way', async ({ page }) => {
    await matchUnderWay(page)
    await capture(page, 'match-phone-landscape')
  })

  test.describe('details at the phone\'s own density', () => {
    test.use({ deviceScaleFactor: 3 })

    test('a broadside of three parallel shots and the bow cannon', async ({ page }) => {
      // Facing right in the open lane at the top, the right broadside fires down across open water.
      await startMatch(page, { spawns: false, player: { x: 640, y: 60, angle: 0 } })
      await page.keyboard.down('KeyE')
      await page.keyboard.down('Space')
      await advance(page, 12)
      await page.keyboard.up('Space')
      await page.keyboard.up('KeyE')
      await settle(page)
      await captureArena(page, 'broadside-phone', { x: 480, y: 0, width: 400, height: 300 })
    })

    test('an enemy sinks: explosion, sailors overboard and the point', async ({ page }) => {
      await startMatch(page, {
        spawns: false,
        player: { x: 200, y: 60, angle: 0 },
        enemies: [{ kind: 'chaser', x: 520, y: 60, angle: Math.PI }],
      })
      await page.keyboard.down('Space')
      for (let step = 0; step < 300 && (await matchState(page)).enemies.length > 0; step += 1) {
        await advance(page, 1)
      }
      await page.keyboard.up('Space')
      await advance(page, 12)
      await settle(page)
      await expect(page.getByTestId('hud-score')).toHaveText('1')
      await captureArena(page, 'sinking-phone', { x: 260, y: 0, width: 400, height: 300 })
    })
  })

  test('the score of a sunk enemy in the HUD', async ({ page }) => {
    await startMatch(page, {
      spawns: false,
      player: { x: 200, y: 60, angle: 0 },
      enemies: [{ kind: 'chaser', x: 520, y: 60, angle: Math.PI }],
    })
    await page.keyboard.down('Space')
    for (let step = 0; step < 300 && (await matchState(page)).enemies.length > 0; step += 1) {
      await advance(page, 1)
    }
    await page.keyboard.up('Space')
    await advance(page, 12)
    await settle(page)
    await expect(page.getByTestId('hud-score')).toHaveText('1')
    await capture(page, 'score-phone')
  })

  test('pauses by hand and when the window loses focus', async ({ page }) => {
    await startMatch(page, { seed: MAP_SEED, map: 'generated', spawns: false })
    await page.getByRole('button', { name: 'Pause' }).click()
    const dialog = page.getByRole('dialog', { name: 'Paused' })
    await expect(dialog).toBeVisible()
    await capture(page, 'pause-phone')

    await dialog.getByRole('button', { name: 'Resume' }).click()
    await expect(dialog).toBeHidden()
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect(dialog).toContainText('the window lost focus')
    await capture(page, 'pause-focus-phone')
  })

  test('result when time runs out', async ({ page }) => {
    await finishQuietMatch(page)
    await expect(page.getByTestId('registration-status')).toHaveAttribute('data-status', 'confirmed')
    await capture(page, 'result-time-phone')
  })

  test('loading progress, a failed load and its retry', async ({ page, context, consoleErrors }) => {
    let releaseTiles = () => {}
    const tilesHeld = new Promise<void>((resolve) => {
      releaseTiles = resolve
    })
    await context.route('**/tiles_sheet*.png', async (route) => {
      await tilesHeld
      await route.continue()
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('progressbar', { name: 'Loading the fleet…' })).toBeVisible()
    await capture(page, 'loading-phone')
    releaseTiles()

    consoleErrors.allow(/Failed to load resource/)
    await context.route('**/ships_miscellaneous_sheet*.png', (route) => route.abort())
    await page.goto('/')
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('alert')).toContainText('could not be loaded')
    await capture(page, 'loading-error-phone')
  })

  test('two drawn maps', async ({ page }) => {
    for (const seed of [24, 26]) {
      await startMatch(page, { seed, map: 'generated', spawns: false })
      await settle(page)
      await capture(page, `map-${seed}-phone`)
    }
  })
})

test.describe('desktop', () => {
  test.use(DESKTOP)

  test('main menu with the keyboard controls', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('tabpanel', { name: 'Ranking' }).getByRole('table')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Mock API' })).toHaveText('Mock API: online')
    await capture(page, 'menu-desktop')
  })
})
