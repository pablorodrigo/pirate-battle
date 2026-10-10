import { createContext, useContext, useSyncExternalStore } from 'react'
import type { RegistrationCoordinator, RegistrationStatus } from './RegistrationCoordinator.ts'

export const RegistrationContext = createContext<RegistrationCoordinator | null>(null)

export function useRegistration(): RegistrationCoordinator {
  const coordinator = useContext(RegistrationContext)
  if (!coordinator) {
    throw new Error('useRegistration must be used inside a RegistrationProvider.')
  }
  return coordinator
}

export function useRegistrationStatus(matchId: string): RegistrationStatus {
  const coordinator = useRegistration()
  useSyncExternalStore(coordinator.subscribe, coordinator.getVersion)
  return coordinator.statusOf(matchId)
}
