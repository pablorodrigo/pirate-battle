import { expect, test } from '../support/fixtures.ts'
import { advance, expectGameReady, holdKey, matchState, startMatch, STEPS_PER_SECOND } from '../support/match.ts'

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
  await expectGameReady(page)
  const state = await matchState(page)
  expect(state).toMatchObject({ status: 'running', step: 0, score: 0, enemies: [], projectiles: [] })
  expect(state.player.health).toBe(100)
  await expect(page.getByTestId('hud-time')).toHaveText('2:00')
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('abandoning a match from the pause menu records nothing', async ({ page }) => {
  let registrations = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/matches')) {
      registrations += 1
    }
  })
  await startMatch(page, { spawns: false })
  await advance(page, 30 * STEPS_PER_SECOND)

  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()

  // No result reopens after a reload, and neither list knows the abandoned match.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
  const ranking = page.getByRole('tabpanel', { name: 'Ranking' })
  await expect(ranking.getByRole('table')).toBeVisible()
  await expect(ranking.getByRole('row', { name: /\(you\)/ })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Match History' })).toContainText('no registered matches yet')
  expect(await page.evaluate(() => window.localStorage.getItem('pirate-battle:journal'))).toBeNull()
  expect(registrations).toBe(0)
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
