import { expect, test } from '../support/fixtures.ts'
import { advance, holdKey, matchState, startMatch, STEPS_PER_SECOND } from '../support/match.ts'

// The top lane (y = 60) is open water from edge to edge.
const lanePlayer = { x: 200, y: 60, angle: 0 }

test('fires one front shot and respects its cooldown', async ({ page }) => {
  await startMatch(page, { spawns: false, player: lanePlayer })
  const shots = async () => (await matchState(page)).projectiles.length

  await page.keyboard.down('Space')
  await advance(page, 1)
  expect(await shots()).toBe(1)
  await advance(page, 14)
  expect(await shots()).toBe(1)
  await advance(page, 1)
  expect(await shots()).toBe(2)
  await page.keyboard.up('Space')
})

test('fires three parallel shots to each side with separate cooldowns', async ({ page }) => {
  await startMatch(page, { spawns: false, player: { x: 640, y: 560, angle: 0 } })

  await holdKey(page, 'KeyQ', 1)
  let { projectiles } = await matchState(page)
  expect(projectiles).toHaveLength(3)
  for (const shot of projectiles) {
    expect(shot.stepX).toBeCloseTo(0, 5)
    expect(shot.stepY).toBeLessThan(0)
  }

  await holdKey(page, 'KeyE', 1)
  ;({ projectiles } = await matchState(page))
  expect(projectiles.filter((shot) => shot.stepY > 0)).toHaveLength(3)

  // The left side is still cooling down.
  await holdKey(page, 'KeyQ', 1)
  expect((await matchState(page)).projectiles.filter((shot) => shot.stepY < 0)).toHaveLength(3)
})

test('destroys an enemy with cannon fire and scores exactly one point', async ({ page }) => {
  await startMatch(page, {
    spawns: false,
    player: lanePlayer,
    enemies: [{ kind: 'shooter', x: 460, y: 60, angle: Math.PI }],
  })

  await holdKey(page, 'Space', 40)
  let state = await matchState(page)
  expect(state.enemies).toHaveLength(0)
  expect(state.score).toBe(1)

  await holdKey(page, 'Space', STEPS_PER_SECOND)
  state = await matchState(page)
  expect(state.score).toBe(1)
  await expect(page.getByTestId('hud-score')).toHaveText('1')
})

test('a Chaser rams the player once, sinks and scores nothing', async ({ page }) => {
  await startMatch(page, {
    spawns: false,
    player: lanePlayer,
    enemies: [{ kind: 'chaser', x: 600, y: 60, angle: Math.PI }],
  })

  await advance(page, STEPS_PER_SECOND * 5)
  const state = await matchState(page)
  expect(state.enemies).toHaveLength(0)
  expect(state.player.health).toBe(75)
  expect(state.score).toBe(0)
  await expect(page.getByTestId('hud-health')).toContainText('75')
})

test('a Shooter in range fires on its cooldown', async ({ page }) => {
  await startMatch(page, {
    spawns: false,
    player: lanePlayer,
    enemies: [{ kind: 'shooter', x: 440, y: 60, angle: Math.PI }],
  })

  await advance(page, STEPS_PER_SECOND * 5)
  const state = await matchState(page)
  const damage = 100 - state.player.health
  // Ten damage per hit, with 1.5 s between shots.
  expect(damage).toBeGreaterThanOrEqual(20)
  expect(damage).toBeLessThanOrEqual(40)
  expect(damage % 10).toBe(0)
  expect(state.enemies).toHaveLength(1)
})

test('spawns a Chaser and then a Shooter at the configured interval', async ({ page }) => {
  await startMatch(page)
  const interval = 2.5 * STEPS_PER_SECOND

  await advance(page, interval - 1)
  expect((await matchState(page)).enemies).toHaveLength(0)
  await advance(page, 1)
  expect((await matchState(page)).enemies.map((enemy) => enemy.kind)).toEqual(['chaser'])
  await advance(page, interval)
  expect((await matchState(page)).enemies.map((enemy) => enemy.kind)).toEqual(['chaser', 'shooter'])
})
