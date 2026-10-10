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
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
})
