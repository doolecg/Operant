import { useQuery } from '@tanstack/react-query'
import { call, registerLive, useMutate } from './core'

export const useEngineeringStatus = () => useQuery({ queryKey: ['engineering'], queryFn: () => call('engineering:status') })

// Backs up the edited files, puts the built-in pack back, and refreshes every query (the status included).
export const useResetEngineering = () => useMutate('engineering:reset')

const stagesKey = (crewId: number) => ['engineering-stages', crewId]
export const useTaskStages = (crewId: number | null, on: boolean) =>
  useQuery({ queryKey: stagesKey(crewId ?? -1), queryFn: () => call('engineering:stages', crewId!), enabled: on && crewId !== null })

const planKey = (crewId: number) => ['engineering-plan', crewId]
export const useTaskPlan = (crewId: number | null) =>
  useQuery({ queryKey: planKey(crewId ?? -1), queryFn: () => call('engineering:plan', crewId!), enabled: crewId !== null })

const tasksKey = (crewId: number) => ['engineering-tasks', crewId]
export const taskListQuery = (crewId: number) => ({ queryKey: tasksKey(crewId), queryFn: () => call('engineering:tasks:list', crewId) })

registerLive((b, qc) => [
  b.on('engineering:tasks', ({ crewId }) => {
    for (const queryKey of [stagesKey(crewId), planKey(crewId), tasksKey(crewId)]) void qc.invalidateQueries({ queryKey })
  }),
])
