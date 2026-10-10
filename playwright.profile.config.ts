import { defineConfig } from '@playwright/test'

const PORT = 4175

/**
 * Profiling runs, kept out of the regular suite: `npm run profile`. Google
 * Chrome's headless mode renders on the real GPU with a steady 60 Hz frame
 * clock, unlike the software-rendered headless shell the tests use.
 */
export default defineConfig({
  testDir: './tests/profile',
  timeout: 10 * 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    headless: true,
    locale: 'en-US',
  },
  projects: [
    // The built-in display of the reference laptop, with Chrome in full screen.
    { name: 'retina-1512x982', use: { viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 } },
    { name: 'full-hd-1920x1080', use: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } },
  ],
  // The e2e build is the optimized production build plus the read-only test
  // bridge, which the profile needs to count entities and to steer the bot.
  webServer: {
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
