import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'
import { advance, matchState, startMatch } from '../support/match.ts'

test.skip(({ hasTouch }) => !hasTouch, 'On-screen controls only exist on touch devices.')

type TouchPoint = { x: number; y: number; id: number }

async function pointOf(page: Page, name: string, id: number): Promise<TouchPoint> {
  const box = await page.getByRole('button', { name }).boundingBox()
  if (!box) {
    throw new Error(`No "${name}" button on screen.`)
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, id }
}

const playerShots = async (page: Page) =>
  (await matchState(page)).projectiles.filter((projectile) => projectile.faction === 'player').length

// Playwright's touchscreen only taps, so held, simultaneous fingers go through CDP.
// A touchEnd lists the fingers being lifted.
test('sails and fires at once with two fingers, and each finger releases only its action', async ({ page }) => {
  // The top lane (y = 60) is open water, so shots fly their full range.
  await startMatch(page, { spawns: false, player: { x: 200, y: 60, angle: 0 } })
  const touch = await page.context().newCDPSession(page)
  const forward = await pointOf(page, 'Sail forward', 1)
  const fire = await pointOf(page, 'Fire from the bow', 2)

  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [forward] })
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [forward, fire] })
  await advance(page, 30)
  let state = await matchState(page)
  expect(state.player.x).toBeCloseTo(200 + 90, 0)
  expect(await playerShots(page)).toBe(2)

  // Lifting the first finger stops sailing; the second keeps firing.
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [forward] })
  await advance(page, 30)
  state = await matchState(page)
  expect(state.player.x).toBeCloseTo(200 + 90, 0)
  expect(await playerShots(page)).toBe(4)

  // With every finger lifted, no new shot is fired (all four are still within their lifetime).
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [fire] })
  await advance(page, 10)
  expect(await playerShots(page)).toBe(4)
})

test('turns with the on-screen buttons', async ({ page }) => {
  await startMatch(page, { spawns: false, player: { x: 640, y: 60, angle: 0 } })
  const touch = await page.context().newCDPSession(page)
  const right = await pointOf(page, 'Turn right', 1)

  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [right] })
  await advance(page, 30)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect((await matchState(page)).player.angle).toBeCloseTo(Math.PI / 2, 2)
})

test('pauses in portrait and resumes only on request', async ({ page }) => {
  await startMatch(page, { spawns: false })
  const landscape = page.viewportSize() ?? { width: 863, height: 360 }

  await page.setViewportSize({ width: landscape.height, height: landscape.width })
  const dialog = page.getByRole('dialog', { name: 'Paused' })
  await expect(dialog).toContainText('portrait')

  await page.setViewportSize(landscape)
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Resume' }).click()
  await expect(dialog).toBeHidden()
  expect((await matchState(page)).status).toBe('running')
})
