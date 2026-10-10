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

/** Waits until a button shows the press or release, so the input has seen it before steps run. */
async function expectPressed(page: Page, name: string, pressed: boolean): Promise<void> {
  await expect(page.getByRole('button', { name })).toHaveAttribute('data-pressed', String(pressed))
}

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
  await expectPressed(page, 'Sail forward', true)
  await expectPressed(page, 'Fire from the bow', true)
  await advance(page, 30)
  let state = await matchState(page)
  expect(state.player.x).toBeCloseTo(200 + 90, 0)
  expect(await playerShots(page)).toBe(2)

  // Lifting the first finger stops sailing; the second keeps firing.
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [forward] })
  await expectPressed(page, 'Sail forward', false)
  await advance(page, 30)
  state = await matchState(page)
  expect(state.player.x).toBeCloseTo(200 + 90, 0)
  expect(await playerShots(page)).toBe(4)

  // With every finger lifted, no new shot is fired (all four are still within their lifetime).
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [fire] })
  await expectPressed(page, 'Fire from the bow', false)
  await advance(page, 10)
  expect(await playerShots(page)).toBe(4)
})

test('turns with the on-screen buttons', async ({ page }) => {
  await startMatch(page, { spawns: false, player: { x: 640, y: 60, angle: 0 } })
  const touch = await page.context().newCDPSession(page)
  const right = await pointOf(page, 'Turn right', 1)

  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [right] })
  await expectPressed(page, 'Turn right', true)
  await advance(page, 30)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect((await matchState(page)).player.angle).toBeCloseTo(Math.PI / 2, 2)
})

test('keeps playing when the screen turns, with the controls in their new place', async ({ page }) => {
  await startMatch(page, { spawns: false, player: { x: 200, y: 60, angle: 0 } })
  const landscape = page.viewportSize() ?? { width: 863, height: 360 }
  const screen = page.getByRole('main')

  // Turning to portrait changes the layout only: no pause, same match.
  await page.setViewportSize({ width: landscape.height, height: landscape.width })
  await expect(screen).toHaveAttribute('data-layout', 'portrait')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden()
  expect((await matchState(page)).status).toBe('running')

  const touch = await page.context().newCDPSession(page)
  const forward = await pointOf(page, 'Sail forward', 1)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [forward] })
  await expectPressed(page, 'Sail forward', true)
  await advance(page, 30)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [forward] })
  await expectPressed(page, 'Sail forward', false)
  expect((await matchState(page)).player.x).toBeCloseTo(200 + 90, 0)

  await page.setViewportSize(landscape)
  await expect(screen).toHaveAttribute('data-layout', 'landscape')
  expect((await matchState(page)).status).toBe('running')
})
