import { expect, type Page } from '@playwright/test'
import type { BridgeMatchState, MatchScenario } from '../../src/testing/bridgeTypes.ts'

export const STEPS_PER_SECOND = 60

/**
 * Starts a match from the main menu with a test scenario. The manual clock is
 * on by default, so the simulation only advances through `advance()`.
 */
export async function startMatch(page: Page, scenario: MatchScenario = {}): Promise<void> {
  const resolved: MatchScenario = { seed: 1, manualClock: true, ...scenario }
  await page.addInitScript((value) => {
    window.__PIRATE_BATTLE_SCENARIO__ = value
  }, resolved)
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'ready')
}

/** Runs whole simulation steps with whatever input the test is holding. */
export async function advance(page: Page, steps: number): Promise<void> {
  await page.evaluate((count) => window.__PIRATE_BATTLE__?.advance(count), steps)
}

export async function matchState(page: Page): Promise<BridgeMatchState> {
  const state = await page.evaluate(() => window.__PIRATE_BATTLE__?.state() ?? null)
  if (!state) {
    throw new Error('No match is running.')
  }
  return state
}

/** Holds a key for a number of simulation steps, then releases it. */
export async function holdKey(page: Page, key: string, steps: number): Promise<void> {
  await page.keyboard.down(key)
  await advance(page, steps)
  await page.keyboard.up(key)
}
