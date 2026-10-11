import { useState, type KeyboardEvent } from 'react'
import { GraduationCap, Loader2, Navigation, Send } from 'lucide-react'
import type { LearnRunInfo } from '@shared/learn'
import { bridge } from '@/lib/bridge'
import { useSettings } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const pillClass =
  'bg-accent/60 text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] disabled:opacity-50 disabled:hover:bg-accent/60'

const ipcMessage = (e: unknown) => (e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']*': (Error: )?/, '') : String(e))

function describeRun(r: LearnRunInfo | null): { text: string; error: boolean } {
  if (!r) return { text: 'Learning is off for this project', error: false }
  if (r.error) return { text: r.error.startsWith('Skipped: ') ? `Nothing learned. ${r.error}` : r.error, error: !r.error.startsWith('Skipped: ') }
  const parts = [`${r.extracted} lesson${r.extracted === 1 ? '' : 's'} found`, `${r.written} written`, `${r.merged} merged`]
  if (r.queued) parts.push(`${r.queued} queued for review`)
  return { text: `Learned from this session: ${parts.join(', ')}`, error: false }
}

// Learns from this tile's Claude session now, instead of waiting for it to go quiet or close.
export function LearnPill({ scratchId }: { scratchId: number }) {
  const learn = useSettings().data?.learn
  const [busy, setBusy] = useState(false)
  if (!learn || !learn.enabled || learn.mode === 'off') return null
  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { text, error } = describeRun(await bridge().invoke('learn:runNow', scratchId))
      toast(text, error)
    } catch (e) {
      toast(`Could not learn from this session: ${ipcMessage(e)}`, true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" onClick={() => void run()} disabled={busy} aria-label={busy ? 'Learning from this session' : 'Learn from this session'} title="Read this session now and save what it taught as lessons" className={pillClass}>
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <GraduationCap className="size-3.5" aria-hidden />} {busy ? 'Learning…' : 'Learn'}
    </button>
  )
}

// Sends a short note to Claude while a turn is running, without stopping it.
export function SteerPill({ scratchId, running }: { scratchId: number; running: boolean }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await bridge().invoke('chat:steer', scratchId, body)
      setText('')
      setOpen(false)
    } catch (e) {
      toast(`Could not steer Claude: ${ipcMessage(e)}`, true)
    } finally {
      setSending(false)
    }
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }
  return (
    <Popover open={open && running} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={!running} aria-label="Steer Claude" title={running ? 'Send Claude a note while it works' : 'Steer works while Claude is working'} className={pillClass}>
          <Navigation className="size-3.5" aria-hidden /> Steer
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 max-w-[calc(100vw-2rem)] p-2">
        <textarea
          aria-label="Steer message"
          rows={2}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tell Claude what to change while it works"
          className="border-border bg-background placeholder:text-muted-foreground/70 w-full resize-none rounded-md border px-2 py-1.5 text-[13px] outline-none"
        />
        <div className="mt-1.5 flex justify-end">
          <button type="button" onClick={() => void send()} disabled={!text.trim() || sending} aria-label="Send steer" className="bg-primary text-primary-foreground inline-flex h-[26px] items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] hover:opacity-90 disabled:opacity-50">
            {sending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />} Send
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
