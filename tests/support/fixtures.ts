import { test as base, expect } from '@playwright/test'

type ConsoleGuard = {
  /** Declares an error the test provokes on purpose, such as a blocked request. */
  allow: (pattern: RegExp) => void
}

type Fixtures = {
  consoleErrors: ConsoleGuard
}

export const test = base.extend<Fixtures>({
  // The console must stay free of errors during every expected flow, so any
  // console error or uncaught exception fails the test that produced it.
  consoleErrors: [
    async ({ page }, provide) => {
      const errors: string[] = []
      const allowed: RegExp[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text())
        }
      })
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })
      await provide({ allow: (pattern) => allowed.push(pattern) })
      const unexpected = errors.filter((error) => !allowed.some((pattern) => pattern.test(error)))
      expect(unexpected, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
