import type { ReactNode } from 'react'
import type { RegistrationCoordinator } from './RegistrationCoordinator.ts'
import { RegistrationContext } from './registrationContext.ts'

type RegistrationProviderProps = {
  coordinator: RegistrationCoordinator
  children: ReactNode
}

export function RegistrationProvider({ coordinator, children }: RegistrationProviderProps) {
  return <RegistrationContext.Provider value={coordinator}>{children}</RegistrationContext.Provider>
}
