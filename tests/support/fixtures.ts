import { test as base, expect } from '@playwright/test'

type Fixtures = {
  consoleErrors: string[]
}

export const test = base.extend<Fixtures>({
  // The console must stay free of errors during every expected flow, so any
  // console error or uncaught exception fails the test that produced it.
  consoleErrors: [
    async ({ page }, provide) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text())
        }
      })
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })
      await provide(errors)
      expect(errors, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
