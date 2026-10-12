import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bridge } from '@/lib/bridge'
import { call } from '@/lib/queries'

const KEY = ['tilePopouts'] as const

// The scratch ids of the tiles that are in their own windows; main pushes 'tile:popouts' on every change.
export function useTilePopouts(): number[] | undefined {
  const qc = useQueryClient()
  useEffect(
    () =>
      bridge().on('tile:popouts', (ids) => {
        qc.setQueryData(KEY, ids)
        // A tile that came back may have switched between Chat and Terminal while it was out.
        void qc.invalidateQueries({ queryKey: ['scratchViews'] })
      }),
    [qc],
  )
  return useQuery({ queryKey: KEY, queryFn: () => call('tile:popouts') }).data
}
