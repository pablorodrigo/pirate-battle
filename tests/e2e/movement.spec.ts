import { expect, test } from '../support/fixtures.ts'
import { holdKey, matchState, startMatch, STEPS_PER_SECOND } from '../support/match.ts'

const PLAYER_SPEED = 180
const PLAYER_RADIUS = 22

test('sails forward and turns at the configured speeds', async ({ page }) => {
  await startMatch(page, { spawns: false, player: { x: 300, y: 368, angle: 0 } })

  await holdKey(page, 'KeyW', STEPS_PER_SECOND)
  let state = await matchState(page)
  expect(state.player.x).toBeCloseTo(300 + PLAYER_SPEED, 1)
  expect(state.player.y).toBeCloseTo(368, 1)

  await holdKey(page, 'KeyD', STEPS_PER_SECOND / 2)
  state = await matchState(page)
  expect(state.player.angle).toBeCloseTo(Math.PI / 2, 2)
  expect(state.player.x).toBeCloseTo(300 + PLAYER_SPEED, 1)

  await holdKey(page, 'ArrowLeft', STEPS_PER_SECOND / 2)
  state = await matchState(page)
  expect(state.player.angle).toBeCloseTo(0, 2)
})

test('keeps the whole hull inside the arena', async ({ page }) => {
  await startMatch(page, { spawns: false, player: { x: 80, y: 360, angle: Math.PI } })

  await holdKey(page, 'ArrowUp', STEPS_PER_SECOND * 2)
  const state = await matchState(page)
  expect(state.player.x).toBeCloseTo(PLAYER_RADIUS, 5)
})

test('stops at an island and slides along its face', async ({ page }) => {
  // The center island spans x 544–736 and y 288–416.
  await startMatch(page, { spawns: false, player: { x: 480, y: 300, angle: Math.PI / 4 } })

  await holdKey(page, 'KeyW', 40)
  const state = await matchState(page)
  expect(state.player.x).toBeCloseTo(544 - PLAYER_RADIUS, 5)
  expect(state.player.y).toBeGreaterThan(330)
  expect(state.player.y).toBeLessThan(416)
})
