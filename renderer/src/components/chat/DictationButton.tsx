import { Mic } from 'lucide-react'
import type { useDictation } from './useDictation'

const IDLE_HINT = 'Start dictation. The first use downloads a speech model (about 40 to 150 MB); after that it works offline on this device.'

// The mic button in the chat composer. Click once to start listening, click again to stop; the words are
// handed to the composer, which inserts them at the caret.
export function DictationButton({ dictation }: { dictation: ReturnType<typeof useDictation> }) {
  const { state, error, toggle } = dictation
  const recording = state === 'recording'
  const busy = state === 'loading' || state === 'transcribing'
  const status = error ?? (state === 'loading' ? 'Loading speech model…' : state === 'transcribing' ? 'Transcribing…' : recording ? 'Listening. Click to stop.' : IDLE_HINT)
  return (
    <button
      type="button"
      aria-label={recording ? 'Stop dictation' : 'Start dictation'}
      aria-pressed={recording}
      title={status}
      disabled={busy}
      onClick={toggle}
      className="text-muted-foreground hover:bg-accent hover:text-foreground relative inline-flex h-[26px] w-[26px] items-center justify-center rounded-[7px] disabled:opacity-60"
    >
      <Mic className="size-3.5" aria-hidden />
      {recording && <span className="absolute top-[3px] right-[3px] size-2 animate-pulse rounded-full bg-red-500" aria-hidden />}
      <span role="status" className="sr-only">
        {busy || error ? status : ''}
      </span>
    </button>
  )
}
