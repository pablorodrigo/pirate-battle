import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { startMockApi } from './app/bootstrapMocks.ts'
import { createQueryClient } from './app/queryClient.ts'
import { matchJournal } from './features/registration/matchJournal.ts'
import { RegistrationCoordinator } from './features/registration/RegistrationCoordinator.ts'
import { RegistrationProvider } from './features/registration/RegistrationProvider.tsx'
import { soundBank } from './game/audio/SoundBank.ts'
import { InterfaceSoundContext, type InterfaceSound } from './shared/ui/interfaceSound.ts'
import { installUiSkin } from './shared/ui/uiSkin.ts'
import './shared/styles/global.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Missing #root element in index.html')
}
installUiSkin()

// Only the e2e build defines this flag, so the public bundle drops the bridge.
if (import.meta.env.VITE_ENABLE_TEST_BRIDGE === 'true') {
  const { installTestBridge } = await import('./testing/installTestBridge.ts')
  installTestBridge()
}

// The game must stay playable without the API, so a failed mock start is
// reported and the app renders anyway.
try {
  await startMockApi()
} catch (error) {
  console.warn('The mock API could not start.', error)
}

// The mock API and the registration coordinator stop for good once the page
// starts unloading, so a page restored from the back/forward cache loads again.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload()
  }
})

const queryClient = createQueryClient()
// Lives for the whole app: pending registrations keep going across screens and matches.
const registration = new RegistrationCoordinator(queryClient, matchJournal)
registration.start()
// Menu buttons play their sounds through the game's sound bank, which honours the sound setting.
const playInterfaceSound = (sound: InterfaceSound) => soundBank.playInterface(sound)

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RegistrationProvider coordinator={registration}>
        <InterfaceSoundContext value={playInterfaceSound}>
          <App />
        </InterfaceSoundContext>
      </RegistrationProvider>
    </QueryClientProvider>
  </StrictMode>,
)
