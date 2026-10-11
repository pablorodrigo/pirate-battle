import { defineConfig, devices } from '@playwright/test'

const PORT = 4185

/**
 * Captures the screenshots of docs/ACCEPTANCE.md, kept out of the regular
 * suite: `npm run acceptance`. Each capture runs on the e2e build, whose
 * read-only bridge sets the scene up, in Chromium; the specs pick the screen.
 */
export default defineConfig({
  testDir: './tests/acceptance',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  webServer: {
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
