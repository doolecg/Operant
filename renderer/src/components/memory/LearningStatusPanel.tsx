import { LEARN_STORES, type LearnSettings, type LearnStore } from '@shared/learn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { timeAgo } from '@/lib/format'
import { useHindsightStatus, useLearnStatus, useLessons, useSaveSettings, useSetLessonStatus, useSettings } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { ErrorLine, STORE_LABEL } from './ui'

// The learning loop at a glance: per store health, the last learn run and what waits for review.
export function LearningStatusPanel({ crewId, onShowDrafts }: { crewId: number | null; onShowDrafts: () => void }) {
  const status = useLearnStatus(crewId ?? undefined)
  const settings = useSettings()
  const hindsight = useHindsightStatus().data
  const save = useSaveSettings()
  const pending = useLessons({ ...(crewId != null ? { crewId } : {}), status: 'pending' })
  const setStatus = useSetLessonStatus()
  const s = status.data
  const toggle = (patch: Partial<LearnSettings>) => save.mutate({ learn: patch })
  const last = s?.lastRun
  const total = s?.totals
  const learn = settings.data?.learn

  return (
    <Card aria-label="Learning status" role="region">
      <CardHeader>
        <CardTitle className="text-base">Learning status</CardTitle>
        <CardDescription>Whether learning is on, what the last run did, and how each place it writes to is doing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ErrorLine error={status.error ?? save.error} />
        {s && learn && (
          <>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div aria-label="Last learn run" role="group">
                <div className="text-sm font-medium">
                  Learning is {s.enabled ? 'on' : 'off'}
                  <span className="text-muted-foreground font-normal">
                    {' · '}
                    {!last ? 'no learn run yet' : last.error ? `last run ${timeAgo(last.at)} did nothing` : `last run ${timeAgo(last.at)}: ${last.extracted} found, ${last.written} written, ${last.merged} merged${last.staled ? `, ${last.staled} marked stale` : ''}${last.queued ? `, ${last.queued} queued for review` : ''}`}
                  </span>
                </div>
                {last?.error && <p className="text-destructive text-xs">Did nothing: {last.error}</p>}
                {last?.model && (
                  <p className="text-muted-foreground text-xs">
                    AI: {last.cli === 'opencode' ? 'OpenCode' : 'Claude Code'} · <span className="font-mono">{last.model}</span>
                  </p>
                )}
                {last && last.skipped.length > 0 && (
                  <ul className="text-muted-foreground list-disc pl-5 text-xs">
                    {last.skipped.map((k) => (
                      <li key={`${k.store}:${k.reason}`}>
                        {STORE_LABEL[k.store]} skipped: {k.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Switch aria-label="Learning on or off" checked={learn.enabled} onCheckedChange={(v) => toggle({ enabled: v })} />
            </div>

            <ul className="grid gap-2 sm:grid-cols-3" aria-label="Learning stores">
              {LEARN_STORES.map((id: LearnStore) => {
                const st = s.stores.find((x) => x.store === id)
                if (!st) return null
                return (
                  <li key={id} className="space-y-1.5 rounded-md border p-3" data-store={id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{STORE_LABEL[id]}</span>
                      <Switch aria-label={`${STORE_LABEL[id]} on or off`} checked={learn[id]} onCheckedChange={(v) => toggle({ [id]: v })} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Badge variant="outline" className={cn(st.enabled ? 'text-emerald-400' : 'text-muted-foreground')}>
                        {st.enabled ? 'On' : 'Off'}
                      </Badge>
                      <Badge variant="outline" className={cn(st.up ? 'text-emerald-400' : 'text-destructive')}>
                        {st.up ? 'Up' : 'Down'}
                      </Badge>
                      {id === 'hindsight' && hindsight?.mode && <Badge variant="secondary">{{ local: 'Local', lan: 'Shared', remote: 'Remote' }[hindsight.mode]}</Badge>}
                      <span className="text-muted-foreground">
                        {st.lessons} {st.lessons === 1 ? 'lesson' : 'lessons'}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">{st.detail}</p>
                  </li>
                )
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs" aria-label="Learning totals" role="group">
              <span>{total?.active ?? 0} active</span>
              <span>{total?.stale ?? 0} stale</span>
              <span>{total?.pending ?? 0} pending review</span>
              <span>{total?.drafts ?? 0} skill drafts</span>
              {s.pendingDrafts > 0 && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onShowDrafts}>
                  {s.pendingDrafts} {s.pendingDrafts === 1 ? 'draft waits' : 'drafts wait'} for approval
                </Button>
              )}
            </div>

            {(pending.data ?? []).length > 0 && (
              <div className="space-y-1.5" aria-label="Lessons waiting for review" role="group">
                <div className="text-sm font-medium">Waiting for review</div>
                <ul className="space-y-1.5">
                  {(pending.data ?? []).slice(0, 5).map((l) => (
                    <li key={l.id} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                      <span className="min-w-0 flex-1 truncate">{l.text}</span>
                      <Button size="sm" aria-label={`Activate lesson ${l.id}`} disabled={setStatus.isPending} onClick={() => setStatus.mutate([l.id, 'active'])}>
                        Activate
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Reject lesson ${l.id}`} disabled={setStatus.isPending} onClick={() => setStatus.mutate([l.id, 'deleted'])}>
                        Reject
                      </Button>
                    </li>
                  ))}
                </ul>
                <ErrorLine error={setStatus.error} />
              </div>
            )}

          </>
        )}
      </CardContent>
    </Card>
  )
}
