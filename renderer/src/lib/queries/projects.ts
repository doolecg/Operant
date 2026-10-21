import { useQuery } from '@tanstack/react-query'
import { call, keys, registerLive, useMutate } from './core'

const GROUPS = ['groups'] as const

export const useGroups = () => useQuery({ queryKey: GROUPS, queryFn: () => call('groups:list') })

// Group changes also change what the project list shows (a project's group), so both lists refresh.
const both = [GROUPS, keys.crews] as const
export const useCreateGroup = () => useMutate('groups:create', both)
export const useRenameGroup = () => useMutate('groups:rename', both)
export const useDeleteGroup = () => useMutate('groups:delete', both)
export const useCollapseGroup = () => useMutate('groups:collapse', both)
export const useReorderGroups = () => useMutate('groups:reorder', both)
export const useMoveToGroup = () => useMutate('groups:move', both)

// Which IDEs are installed, for the "Open in" menu item and the settings page.
export const useIdes = () => useQuery({ queryKey: ['ides'], queryFn: () => call('ide:list'), staleTime: 60_000 })

// Branch and changed-file count of a project (null when the folder is not a git repository). Window focus, a finished
// turn and an exited tile refresh every project (see below).
export const useGitInfo = (crewId: number | null) =>
  useQuery({
    queryKey: ['gitInfo', crewId ?? -1],
    queryFn: () => call('git:info', crewId!),
    enabled: crewId != null,
    staleTime: 10_000,
  })

registerLive((b, qc) => {
  const refresh = () => void qc.invalidateQueries({ queryKey: ['gitInfo'] })
  window.addEventListener('focus', refresh)
  return [() => window.removeEventListener('focus', refresh), b.on('turn:finished', refresh), b.on('scratch:exit', refresh)]
})
