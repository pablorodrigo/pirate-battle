import { defineConfig, devices } from '@playwright/test'

// Ports of their own, away from Vite's defaults (5173 and 4173, counting up when
// taken): local runs reuse a server already on these ports, so a developer's own
// `npm run dev`, which has no test bridge, must never be found there.
const PREVIEW_PORT = 4180
const DEV_PORT = 5180
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests',
  // Profiling and the acceptance captures have configurations of their own.
  testIgnore: ['**/profile/**', '**/acceptance/**'],
  fullyParallel: true,
  forbidOnly: isCI,
  // CI has no GPU: WebGL and page compositing run in software, so frames,
  // input and assertions are several times slower there, above all at the
  // mobile project's pixel density. The checks stay the same; they get more time.
  timeout: isCI ? 60_000 : 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    // Fixed locale and time zone keep number formats and dates reproducible.
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: {
    timeout: isCI ? 10_000 : 5_000,
    // Baselines are versioned per platform; a small ratio absorbs GPU anti-aliasing noise.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7 landscape'] } },
    // React Strict Mode only double-mounts components in development builds,
    // so the same flows also run against the dev server.
    {
      name: 'dev-strict-mode',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` },
      grepInvert: /@visual/,
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
