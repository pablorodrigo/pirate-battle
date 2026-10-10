/**
 * Starts the MSW worker that serves the API. The published demo relies on
 * these mocks, so they stay enabled unless VITE_ENABLE_MOCKS is "false".
 * A `?scenario=<name>` URL parameter selects a network scenario on load.
 */
export async function startMockApi(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') {
    return
  }
  const [{ worker }, { mockServer }, { isNetworkScenario }] = await Promise.all([
    import('../mocks/browser.ts'),
    import('../mocks/mockServer.ts'),
    import('../mocks/networkScenarios.ts'),
  ])
  const requested = new URLSearchParams(window.location.search).get('scenario')
  if (isNetworkScenario(requested)) {
    mockServer.selectScenario(requested)
  }
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
}
