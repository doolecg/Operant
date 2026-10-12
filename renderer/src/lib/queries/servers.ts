import { useQuery } from '@tanstack/react-query'
import { call, registerLive } from './core'

const SERVERS = ['servers'] as const

// The dev servers the projects' tiles started. Read when asked for; the core pushes 'servers:changed' when a tile's
// output looks like a server starting or a tile ends, and a Refresh button reads it again.
export const useServers = () => useQuery({ queryKey: SERVERS, queryFn: () => call('servers:list'), staleTime: 30_000 })

registerLive((b, qc) => [b.on('servers:changed', () => void qc.invalidateQueries({ queryKey: SERVERS }))])
