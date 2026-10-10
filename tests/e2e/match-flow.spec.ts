import { expect, test } from '../support/fixtures.ts'
import { advance, holdKey, matchState, startMatch, STEPS_PER_SECOND } from '../support/match.ts'

test('a held key does not act after resuming until it is pressed again', async ({ page }) => {
  await startMatch(page, { spawns: false, player: { x: 300, y: 368, angle: 0 } })

  await page.keyboard.down('KeyW')
  await advance(page, 30)
  const beforePause = await matchState(page)

  await page.keyboard.press('KeyP')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  await advance(page, STEPS_PER_SECOND * 3)
  expect(await matchState(page)).toMatchObject({ status: 'paused', step: beforePause.step })

  await page.getByRole('button', { name: 'Resume' }).click()
  await advance(page, 30)
  let state = await matchState(page)
  expect(state.status).toBe('running')
  expect(state.player.x).toBeCloseTo(beforePause.player.x, 5)

  await page.keyboard.up('KeyW')
  await holdKey(page, 'KeyW', 30)
  state = await matchState(page)
  expect(state.player.x).toBeGreaterThan(beforePause.player.x + 80)
})

test('ends by timeout, shows the result and restarts cleanly', async ({ page }) => {
  await startMatch(page, { spawns: false })

  await advance(page, 120 * STEPS_PER_SECOND)
  await expect(page.getByRole('heading', { level: 1, name: "Time's up!" })).toBeVisible()
  await expect(page.getByTestId('result-score')).toHaveText('0')
  await expect(page.getByTestId('result-time')).toHaveText('2:00')
  await expect(page.getByTestId('result-reason')).toHaveText('Time ran out')

  await page.getByRole('button', { name: 'Play Again' }).click()
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'ready')
  const state = await matchState(page)
  expect(state).toMatchObject({ status: 'running', step: 0, score: 0, enemies: [], projectiles: [] })
  expect(state.player.health).toBe(100)
  await expect(page.getByTestId('hud-time')).toHaveText('2:00')
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('ends by death when the player sinks', async ({ page }) => {
  await startMatch(page, {
    spawns: false,
    player: { x: 200, y: 60, angle: 0 },
    enemies: [520, 580, 640, 700, 760].map((x) => ({ kind: 'chaser' as const, x, y: 60, angle: Math.PI })),
  })

  await advance(page, STEPS_PER_SECOND * 15)
  await expect(page.getByRole('heading', { level: 1, name: 'Your ship sank' })).toBeVisible()
  await expect(page.getByTestId('result-reason')).toHaveText('Ship destroyed')
  await expect(page.getByTestId('result-score')).toHaveText('0')
})
