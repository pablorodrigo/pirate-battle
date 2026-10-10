import { expect, test } from '../support/fixtures.ts'

test('opens on the main menu', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Pirate Battle')
  await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
})

test('centres the title in its panel', async ({ page }) => {
  await page.goto('/')
  const title = page.getByRole('img', { name: 'Pirate Battle' })
  await expect(title).toHaveJSProperty('complete', true)
  const panel = await page.locator('section', { has: title }).boundingBox()
  const image = await title.boundingBox()
  if (!panel || !image) {
    throw new Error('The menu panel or its title is not on screen.')
  }
  expect(image.x + image.width / 2).toBeCloseTo(panel.x + panel.width / 2, 0)
})

test('explains the controls of the device in use', async ({ page, hasTouch }) => {
  await page.goto('/')
  const guide = page.getByRole('region', { name: 'How to play' })
  await expect(guide.getByRole('term').first()).toHaveText('Sail forward')
  if (hasTouch) {
    // The on-screen buttons, as the match draws them; no keyboard keys.
    await expect(guide.getByRole('img', { name: 'Arrow button, on the left' })).toBeVisible()
    await expect(guide.getByRole('img', { name: 'Right broadside button, on the right' })).toBeVisible()
    await expect(guide.locator('kbd')).toHaveCount(0)
  } else {
    await expect(guide.locator('kbd').first()).toHaveText('W')
    await expect(guide.getByRole('img')).toHaveCount(0)
  }
})

test('reaches the mock API through Axios and TanStack Query', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('status').filter({ hasText: 'Mock API' })).toHaveText('Mock API: online')
})

test('selects no text when a drag crosses the page', async ({ page }) => {
  await page.goto('/')
  const goal = await page.getByText('Sink enemy ships before time runs out.').boundingBox()
  if (!goal) {
    throw new Error('The goal of the game is not on screen.')
  }
  await page.mouse.move(goal.x + 2, goal.y + 4)
  await page.mouse.down()
  await page.mouse.move(goal.x + goal.width - 2, goal.y + goal.height - 4, { steps: 10 })
  await page.mouse.up()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')
})

test('cancels page zoom gestures only while the game screen is up', async ({ page }) => {
  // iOS Safari zooms through its own gesture events; other browsers honour touch-action.
  const pinchIsCancelled = () =>
    page.evaluate(() => {
      const pinch = new Event('gesturestart', { cancelable: true })
      document.dispatchEvent(pinch)
      return pinch.defaultPrevented
    })
  await page.goto('/')
  await expect(page.locator('html')).toHaveCSS('touch-action', 'manipulation')
  expect(await pinchIsCancelled()).toBe(false)

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-state', 'ready')
  await expect(page.getByRole('main')).toHaveCSS('touch-action', 'none')
  expect(await pinchIsCancelled()).toBe(true)

  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
  expect(await pinchIsCancelled()).toBe(false)
})

test('mounts one WebGL canvas per visit and removes it on exit', async ({ page }) => {
  await page.goto('/')

  for (let visit = 1; visit <= 3; visit += 1) {
    await page.getByRole('button', { name: 'Play' }).click()
    const gameCanvas = page.getByTestId('game-canvas')
    await expect(gameCanvas).toHaveAttribute('data-state', 'ready')
    await expect(gameCanvas).toHaveAttribute('data-renderer', 'webgl')
    await expect(page.locator('canvas')).toHaveCount(1)

    await page.getByRole('button', { name: 'Pause' }).click()
    await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Pirate Battle' })).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
  }
})
