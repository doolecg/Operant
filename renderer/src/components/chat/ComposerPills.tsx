import { useState } from 'react'
import { GraduationCap, Loader2 } from 'lucide-react'
import { tokenText, type LearnRunInfo } from '@shared/learn'
import { bridge } from '@/lib/bridge'
import { useSettings } from '@/lib/queries'
import { toast } from '@/lib/toast'

const pillClass =
  'bg-accent/60 text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] disabled:opacity-50 disabled:hover:bg-accent/60'

const ipcMessage = (e: unknown) => (e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']*': (Error: )?/, '') : String(e))

function describeRun(r: LearnRunInfo | null): { text: string; error: boolean } {
  if (!r) return { text: 'Learning is off for this project', error: false }
  if (r.error) return { text: r.error.startsWith('Skipped: ') ? `Nothing learned. ${r.error}` : r.error, error: !r.error.startsWith('Skipped: ') }
  const parts = [`${r.extracted} lesson${r.extracted === 1 ? '' : 's'} found`, `${r.written} written`, `${r.merged} merged`]
  if (r.queued) parts.push(`${r.queued} queued for review`)
  return { text: `Learned from this session: ${parts.join(', ')}${tokenText(r)}`, error: false }
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
