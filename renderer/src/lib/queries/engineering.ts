import { useQuery } from '@tanstack/react-query'
import { call, useMutate } from './core'

export const useEngineeringStatus = () => useQuery({ queryKey: ['engineering'], queryFn: () => call('engineering:status') })

// Backs up the edited files, puts the built-in pack back, and refreshes every query (the status included).
export const useResetEngineering = () => useMutate('engineering:reset')
