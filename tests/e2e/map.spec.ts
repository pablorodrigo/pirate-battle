import { defaultGameplayConfig } from '../../src/game/config/defaultConfig.ts'
import { classicMap } from '../../src/game/core/map/classicMap.ts'
import { generateMap } from '../../src/game/core/map/generateMap.ts'
import { expect, test } from '../support/fixtures.ts'
import { holdKey, matchState, startMatch } from '../support/match.ts'

const PLAYER_RADIUS = 22

test('draws the same map from the same seed and a new one from another', async ({ page }) => {
  await startMatch(page, { seed: 11, map: 'generated', spawns: false })
  const first = (await matchState(page)).islands
  // The page plays exactly the map the generator draws for that seed.
  expect(first).toEqual(generateMap(11, defaultGameplayConfig).arena.islands)
  expect(first).not.toEqual(classicMap.arena.islands)

  await startMatch(page, { seed: 11, map: 'generated', spawns: false })
  expect((await matchState(page)).islands).toEqual(first)

  await startMatch(page, { seed: 12, map: 'generated', spawns: false })
  expect((await matchState(page)).islands).not.toEqual(first)
})

test('stops at an island of a drawn map and slides along its face', async ({ page }) => {
  const seed = 25
  // An island in open water: no other obstacle lies within a channel of its faces.
  const island = generateMap(seed, defaultGameplayConfig).obstacles.find(
    ({ kind, coast }) => kind !== 'reef' && !Object.values(coast).includes(true),
  )
  if (!island) {
    throw new Error(`The map of seed ${seed} has no island in open water.`)
  }
  const { x, y, height } = island.collider
  const start = { x: x - 60, y: y + height / 2 - 30, angle: Math.PI / 6 }
  await startMatch(page, { seed, map: 'generated', spawns: false, player: start })

  await holdKey(page, 'KeyW', 40)
  const state = await matchState(page)
  expect(state.player.x).toBeCloseTo(x - PLAYER_RADIUS, 5)
  expect(state.player.y).toBeGreaterThan(start.y + 20)
  expect(state.player.y).toBeLessThan(y + height)
})
