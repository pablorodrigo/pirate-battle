import type { Locator, Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'
import { startMatch } from '../support/match.ts'

test.skip(({ hasTouch }) => !hasTouch, 'The touch layout only exists on touch devices.')

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const ARENA = { width: 1280, height: 720 }
// Half a pixel absorbs sub-pixel rounding between neighbouring boxes.
const TOLERANCE = 0.5

const CONTROLS = [
  'Sail forward',
  'Turn left',
  'Turn right',
  'Fire from the bow',
  'Fire left side cannons',
  'Fire right side cannons',
]

/** The renderer draws the whole arena, centred and scaled to fit, inside its host. */
function arenaOnScreen(host: Box): Box & { readonly scale: number } {
  const scale = Math.min(host.width / ARENA.width, host.height / ARENA.height)
  const width = ARENA.width * scale
  const height = ARENA.height * scale
  return { x: host.x + (host.width - width) / 2, y: host.y + (host.height - height) / 2, width, height, scale }
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x + TOLERANCE < b.x + b.width &&
  b.x + TOLERANCE < a.x + a.width &&
  a.y + TOLERANCE < b.y + b.height &&
  b.y + TOLERANCE < a.y + a.height

const contains = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x - TOLERANCE &&
  inner.y >= outer.y - TOLERANCE &&
  inner.x + inner.width <= outer.x + outer.width + TOLERANCE &&
  inner.y + inner.height <= outer.y + outer.height + TOLERANCE

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`${String(locator)} is not on screen.`)
  }
  return box
}

/** The HUD parts and every control, by name. */
async function screenParts(page: Page): Promise<Map<string, Box>> {
  const parts = new Map<string, Box>([
    ['health', await boxOf(page.getByTestId('hud-health'))],
    // Score and time are measured with their panels, not just their digits.
    ['score', await boxOf(page.getByTestId('hud-score').locator('..'))],
    ['time', await boxOf(page.getByTestId('hud-time').locator('..'))],
    ['pause', await boxOf(page.getByRole('button', { name: 'Pause' }))],
  ])
  for (const name of CONTROLS) {
    parts.set(name, await boxOf(page.getByRole('button', { name })))
  }
  return parts
}

/** Every part on screen, clear of the arena and of each other; every control large enough to touch. */
function expectPartsApart(parts: ReadonlyMap<string, Box>, arena: Box, screen: Box): void {
  expect(contains(screen, arena), 'the arena is on screen').toBe(true)
  for (const [name, box] of parts) {
    expect(contains(screen, box), `${name} is on screen`).toBe(true)
    expect(overlaps(box, arena), `${name} stays off the arena`).toBe(false)
    for (const [other, otherBox] of parts) {
      if (other !== name) {
        expect(overlaps(box, otherBox), `${name} stays clear of ${other}`).toBe(false)
      }
    }
  }
  for (const name of CONTROLS) {
    const control = parts.get(name)
    expect(control?.width, `${name} is wide enough to touch`).toBeGreaterThanOrEqual(44)
    expect(control?.height, `${name} is tall enough to touch`).toBeGreaterThanOrEqual(44)
  }
}

/** Phone viewports in landscape, with the arena scale each one must at least reach. */
const LANDSCAPE_PHONES = [
  { name: 'iPhone SE', width: 667, height: 375, minScale: 0.35 },
  { name: 'iPhone 15', width: 734, height: 343, minScale: 0.4 },
  { name: 'iPhone 15 Pro Max', width: 814, height: 380, minScale: 0.46 },
  { name: 'Pixel 7', width: 863, height: 360, minScale: 0.48 },
]

for (const phone of LANDSCAPE_PHONES) {
  test(`fits the whole arena, the HUD and the controls apart on a ${phone.name} in landscape`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height })
    await startMatch(page, { spawns: false })
    await expect(page.getByRole('main')).toHaveAttribute('data-layout', 'landscape')
    const arena = arenaOnScreen(await boxOf(page.getByTestId('game-canvas')))

    expectPartsApart(await screenParts(page), arena, { x: 0, y: 0, width: phone.width, height: phone.height })
    expect(arena.scale, 'the arena is drawn as large as the columns allow').toBeGreaterThanOrEqual(phone.minScale)
  })
}

const PORTRAIT_PHONES = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 15', width: 393, height: 659 },
  { name: 'Pixel 7', width: 412, height: 839 },
]

for (const phone of PORTRAIT_PHONES) {
  test(`spans the arena edge to edge on a ${phone.name} in portrait`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height })
    await startMatch(page, { spawns: false })
    await expect(page.getByRole('main')).toHaveAttribute('data-layout', 'portrait')
    const arena = arenaOnScreen(await boxOf(page.getByTestId('game-canvas')))
    const parts = await screenParts(page)

    expectPartsApart(parts, arena, { x: 0, y: 0, width: phone.width, height: phone.height })
    expect(arena.x, 'the arena starts at the left edge').toBeCloseTo(0, 0)
    expect(arena.width, 'the arena reaches the right edge').toBeCloseTo(phone.width, 0)
    for (const name of ['health', 'score', 'time', 'pause']) {
      const box = parts.get(name)
      expect((box?.y ?? Infinity) + (box?.height ?? 0), `${name} sits above the arena`).toBeLessThanOrEqual(
        arena.y + TOLERANCE,
      )
    }
    for (const name of CONTROLS) {
      expect(parts.get(name)?.y, `${name} sits below the arena`).toBeGreaterThanOrEqual(
        arena.y + arena.height - TOLERANCE,
      )
    }
  })
}
