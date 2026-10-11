import { useState } from 'react'
import { useSaveSettings, useSettings } from './queries'

// A panel width the user can drag (the project list, the Notes panel): 0 means the built-in size. It follows the drag live and is saved when the drag ends.
export function usePanelWidth(key: 'sidebarWidth' | 'notesWidth') {
  const stored = useSettings().data?.layout[key] ?? 0
  const save = useSaveSettings()
  const [live, setLive] = useState<number | null>(null)
  const commit = (px: number) => {
    setLive(px)
    save.mutate({ layout: { [key]: px } })
  }
  return { width: live ?? stored, handle: { onResize: setLive, onCommit: commit, onReset: () => commit(0) } }
}
