import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { decodeIpcError } from '@shared/ipc'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { chatActions } from './useChat'

// "Edit from here" on a sent message: the chat goes back to before it and the prompt returns to the chat box.
export function RewindDialog({ scratchId, itemId, onClose }: { scratchId: number; itemId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const run = async (revertFiles: boolean) => {
    setBusy(true)
    setError(null)
    try {
      await chatActions.rewind(scratchId, itemId, revertFiles)
      onClose()
    } catch (e) {
      setError(decodeIpcError(e).message)
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        size="md"
        data-testid="rewind-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit from here?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1.5">
              <p>Rewind chat to before this message. Your prompt and attachments return to the composer. &quot;Revert files too&quot; also undoes your own edits.</p>
              <p>Only edits Claude made with its edit tools are undone, not changes made by commands.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive px-6 text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          {busy && <Loader2 role="status" aria-label="Rewinding" className="text-muted-foreground size-4 animate-spin motion-reduce:animate-none" />}
          <Button ref={cancelRef} variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" aria-label="Revert files too" disabled={busy} onClick={() => void run(true)}>
            Revert files too
          </Button>
          <Button aria-label="Revert and keep changes" disabled={busy} onClick={() => void run(false)}>
            Revert and keep changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
