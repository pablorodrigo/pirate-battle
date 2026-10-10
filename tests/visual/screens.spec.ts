import { expect, test } from '../support/fixtures.ts'
import { advance, finishQuietMatch, startMatch } from '../support/match.ts'

/** A fixed captain keeps the menu identical between runs. */
const VISUAL_PLAYER = { id: 'player-visual', name: 'Captain Visual' }

test.describe('screens', { tag: '@visual' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((player) => {
      window.localStorage.setItem('pirate-battle:player', JSON.stringify({ version: 1, data: player }))
    }, VISUAL_PLAYER)
  })

  test('main menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('tabpanel', { name: 'Ranking' }).getByRole('table')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Mock API' })).toHaveText('Mock API: online')
    await expect(page).toHaveScreenshot('main-menu.png', { fullPage: true })
  })

  test('arena in a known state', async ({ page }) => {
    // Every pixel comes from the real rules: seeded match, placed ships, real key presses.
    await startMatch(page, {
      seed: 7,
      spawns: false,
      player: { x: 460, y: 470, angle: -0.4 },
      enemies: [
        { kind: 'shooter', x: 820, y: 470, angle: Math.PI },
        { kind: 'chaser', x: 980, y: 660, angle: Math.PI },
        { kind: 'shooter', x: 1150, y: 300, angle: Math.PI },
      ],
    })
    await page.keyboard.down('Space')
    await page.keyboard.down('KeyE')
    await advance(page, 75)
    await page.keyboard.up('KeyE')
    await page.keyboard.up('Space')
    await advance(page, 5)
    // Software WebGL in containers renders slowly, so the capture gets more time.
    await expect(page).toHaveScreenshot('arena.png', { timeout: 15_000 })
  })

  test('result screen', async ({ page }) => {
    await finishQuietMatch(page)
    await expect(page.getByTestId('registration-status')).toHaveAttribute('data-status', 'confirmed')
    await expect(page).toHaveScreenshot('result.png')
  })
})
