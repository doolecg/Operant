import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Check, ChevronDown } from 'lucide-react'
import type { BoardCard } from '@shared/board'
import { currentModel, modeLabel, modeOptions } from '@/components/chat/chatHelpers'
import { chatActions, useChatState } from '@/components/chat/useChat'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const chip = 'text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] disabled:opacity-50'

// The slim send row: a message goes to the selected thread, which has to be an open Claude chat.
export function BoardDock({ selected }: { selected: BoardCard | null }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const id = selected?.open && selected.row.agent === 'claude' ? selected.row.id : null
  const state = useChatState(id)
  const model = state ? currentModel(state, selected?.row.model) : null
  const modelName = state ? (state.modelDisplayName ?? model?.displayName ?? state.model) : null
  const ready = id !== null && state !== null
  const send = (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (id === null || !ready || !body) return
    void chatActions.send(id, body).then((ok) => ok && setText(''))
  }
  return (
    <form onSubmit={send} className="bg-card mt-auto mb-6 flex h-[52px] shrink-0 items-center gap-3.5 rounded-full py-0 pr-2 pl-5">
      <span className="text-muted-foreground flex items-center gap-2 text-[12.5px] whitespace-nowrap" aria-live="polite">
        <i aria-hidden className="bg-primary size-[7px] rounded-full" />
        {selected ? '1 selected' : '0 selected'}
      </span>
      <input
        aria-label="Message to the selected thread"
        title={ready ? undefined : selected ? 'Open this thread first to message it' : 'Select a thread first'}
        placeholder="Send a message to the selected thread"
        value={text}
        disabled={!ready}
        onChange={(e) => setText(e.target.value)}
        className="placeholder:text-muted-foreground/70 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
      />
      {state && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger className={chip} aria-label={`Permission mode: ${modeLabel(state.permissionMode)}`}>
              {modeLabel(state.permissionMode)}
              <ChevronDown className="size-3" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end">
              {modeOptions(state).map((m) => (
                <DropdownMenuItem key={m} onSelect={() => id !== null && chatActions.setMode(id, m)}>
                  <span className="flex-1">{modeLabel(m)}</span>
                  {m === state.permissionMode && <Check className="size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className={chip} aria-label={`Model: ${modelName ?? 'unknown'}`} disabled={state.models.length === 0}>
              {modelName ?? 'Model'}
              <ChevronDown className="size-3" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-72">
              {state.models.map((m) => (
                <DropdownMenuItem key={m.value} onSelect={() => id !== null && void chatActions.setModel(id, m.value).then(() => qc.invalidateQueries({ queryKey: ['scratchViews'] }))}>
                  <span className="flex-1">{m.displayName}</span>
                  {model?.value === m.value && <Check className="size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      <button type="submit" aria-label="Send message" disabled={!ready || !text.trim()} className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full hover:opacity-90 disabled:opacity-40">
        <ArrowUp className="size-[18px]" aria-hidden />
      </button>
    </form>
  )
}
