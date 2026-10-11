import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { decodeIpcError } from '@shared/ipc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCodegraphRebuild, useCodegraphStatus, useCrews, useOptionalMcp } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { ConfirmDialog, Row } from '../parts'

export function CodegraphSection() {
  const crews = useCrews()
  const projects = (crews.data ?? []).filter((c) => c.kind === 'project')
  const [crewId, setCrewId] = useState<number | null>(null)
  const crew = projects.find((c) => c.id === crewId) ?? projects[0]
  const status = useCodegraphStatus(crew?.folder)
  const rebuild = useCodegraphRebuild()
  const optional = useOptionalMcp(null)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const s = status.data

  const doRebuild = async () => {
    if (!crew) return
    setError(null)
    try {
      const r = await rebuild.mutateAsync([crew.folder])
      toast(`Rebuilt the CodeGraph index for ${crew.name}: ${r.files} files, ${r.symbols} symbols.`)
      setConfirm(false)
    } catch (e) {
      setError(decodeIpcError(e).message)
    }
  }

  const installed = optional.data?.find((e) => e.id === 'codegraph')?.runtime.ok
  const indexLabel = !s ? (status.isError ? 'Unknown' : 'Checking') : s.indexing ? 'Indexing' : s.initialized ? 'Ready' : 'Not built'

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">CodeGraph</h4>
        <p className="text-muted-foreground text-xs">The code index of a project. Rebuilding discards the index and builds it again from the files.</p>
      </div>
      <div role="group" aria-label="CodeGraph status" className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className={installed === false ? 'text-destructive' : 'text-emerald-400'}>
          {installed === undefined ? 'Checking' : installed ? 'Installed' : 'Not installed'}
        </Badge>
        <Badge variant={s?.indexing || s?.initialized ? 'secondary' : 'outline'}>Index: {indexLabel}</Badge>
        {s?.initialized && (
          <span className="text-xs tabular-nums">
            {s.files.toLocaleString()} files · {s.symbols.toLocaleString()} symbols · {s.edges.toLocaleString()} edges
          </span>
        )}
        {s?.error && <span className="text-destructive text-xs">{s.error}</span>}
      </div>
      <div className="divide-y">
        {projects.length === 0 ? (
          <p className="text-muted-foreground py-3 text-sm">No projects yet.</p>
        ) : (
          <>
            <Row label="Project" htmlFor="cg-project">
              <Select value={String(crew?.id ?? '')} onValueChange={(v) => setCrewId(Number(v))}>
                <SelectTrigger id="cg-project" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Folder">
              <span className="text-muted-foreground max-w-96 truncate font-mono text-xs" title={crew?.folder}>
                {crew?.folder}
              </span>
            </Row>
            <Row label="Rebuild index" hint="Deletes the index, then indexes the project again.">
              <Button variant="outline" size="sm" disabled={!crew || s?.indexing || rebuild.isPending} onClick={() => setConfirm(true)}>
                <RefreshCw /> Rebuild
              </Button>
            </Row>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title={`Rebuild the index for ${crew?.name ?? ''}?`}
        confirmLabel="Rebuild"
        busy={rebuild.isPending}
        error={error}
        onConfirm={() => void doRebuild()}
        onClose={() => {
          setConfirm(false)
          setError(null)
        }}
      >
        <p>The current index is discarded first. Large projects can take a while to index.</p>
      </ConfirmDialog>
    </div>
  )
}
