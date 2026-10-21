import { useEffect, useState } from 'react'

const subscribers = new Set<(now: number) => void>()
let timer: ReturnType<typeof setInterval> | undefined

// One shared one-second clock for every ticking label in the Chat view (the turn heading, each running agent's timer).
// It only runs while something is listening, and `active = false` stops a label listening so a finished one stays frozen.
export function useClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    subscribers.add(setNow)
    if (subscribers.size === 1) timer = setInterval(() => subscribers.forEach((fn) => fn(Date.now())), 1000)
    return () => {
      subscribers.delete(setNow)
      if (subscribers.size === 0) clearInterval(timer)
    }
  }, [active])
  return now
}
