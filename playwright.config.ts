import { defineConfig, devices } from '@playwright/test'

const PREVIEW_PORT = 4174
const DEV_PORT = 5174
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    // Fixed locale and time zone keep number formats and dates reproducible.
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7 landscape'] } },
    // React Strict Mode only double-mounts components in development builds,
    // so the same flows also run against the dev server.
    {
      name: 'dev-strict-mode',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` },
    },
  ],
  // Both servers use the e2e mode, which adds the test bridge; the public
  // build never includes it.
  webServer: [
    {
      command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: `npx vite --mode e2e --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
})
