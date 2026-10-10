/**
 * Starts the MSW worker that serves the API. The published demo relies on
 * these mocks, so they stay enabled unless VITE_ENABLE_MOCKS is "false".
 */
export async function startMockApi(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') {
    return
  }
  const { worker } = await import('../mocks/browser.ts')
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
}
