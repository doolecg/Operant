import { useQuery } from '@tanstack/react-query'
import { call, registerLive } from './core'

// The project's threads: its tiles, open or closed. A closed Claude chat stays here to be opened again.
export const threadsKey = (crewId: number) => ['threads', crewId]
export const useThreads = (crewId: number | null) => useQuery({ queryKey: threadsKey(crewId ?? -1), queryFn: () => call('scratch:list', crewId!), enabled: crewId !== null })
registerLive((b, qc) => [
  b.on('scratch:changed', ({ crewId }) => {
    void qc.invalidateQueries({ queryKey: threadsKey(crewId) })
    void qc.invalidateQueries({ queryKey: ['scratchViews'] })
  }),
])
