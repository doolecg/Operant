import { useQuery } from '@tanstack/react-query'
import { call, registerLive } from './core'

export const notesKey = (crewId: number) => ['notes', crewId] as const

export const useNotes = (crewId: number | null) =>
  useQuery({ queryKey: notesKey(crewId ?? -1), queryFn: () => call('notes:list', crewId!), enabled: crewId != null })

registerLive((b, qc) => [b.on('notes:changed', ({ crewId }) => void qc.invalidateQueries({ queryKey: notesKey(crewId) }))])
