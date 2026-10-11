import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { commandText, installItem, statusLabel } from '@shared/install'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import type { ModId } from '@shared/claude-mods'
import { CLAUDE_MODS } from '@/components/mods/registry'
import { useAppInfo, useCapabilities, useInstallRun, useInstallStatus, useSaveSettings, useSettings } from '@/lib/queries'
import { formatAccel } from '@/lib/keys'
import { NumberField, Row } from '../parts'

export function ModsSection() {
  const settings = useSettings()
  const save = useSaveSettings()
  const caps = useCapabilities().data?.claude
  const run = useInstallRun()
  const speech = useInstallStatus().data?.find((x) => x.id === 'dictation')
  const platform = useAppInfo().data?.platform ?? 'win32'
  const [confirm, setConfirm] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const s = settings.data
  if (!s) return null
  const m = s.claudeMods
  const setMods = (patch: Partial<typeof m>) => save.mutate({ claudeMods: patch })

  return (
    <>
      {s.mainCli === 'opencode' && (
        <p className="text-muted-foreground text-xs" role="note">
          Claude mods only run in Claude Code tiles. OpenCode tiles do not load them.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claude Mods</CardTitle>
          <CardDescription>
            Mods for Claude Code tiles. Operant's Agents panel sits beside the terminal. The other mods are native Claude Code mods: Operant loads
            each enabled one into Claude Code when a tile starts. Changes apply to tiles started from now on.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="Claude Mods" hint="Turns Claude Mods on or off for every Claude tile." htmlFor="mods-enabled">
            <Switch id="mods-enabled" checked={m.enabled} onCheckedChange={(v) => setMods({ enabled: v })} />
          </Row>
          <p className="text-muted-foreground py-3 text-xs">Operant's status line replaces your own inside Operant Claude tiles.</p>
        </CardContent>
      </Card>

      {CLAUDE_MODS.map((mod) => {
        const chat = mod.kind === 'chat'
        const on = chat ? (mod.id === 'commandMenu' ? m.commandMenu : m.keepWarm) : m.mods[mod.id as ModId]
        const Icon = mod.icon
        const unavailable = mod.kind === 'panel' && caps && !caps.subagentEvents && mod.id === 'subagents'
        return (
          <Card key={mod.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="text-muted-foreground size-4" aria-hidden />
                {mod.title}
              </CardTitle>
              <CardDescription>{mod.description}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <Row
                label={`Enable ${mod.title}`}
                hint={
                  unavailable
                    ? 'Unavailable: this Claude Code install does not send sub-agent events.'
                    : chat
                      ? mod.id === 'commandMenu'
                        ? 'An Operant feature of the Chat view, not a Claude Code mod. Off hides the Commands button.'
                        : 'An Operant feature of the Chat view, not a Claude Code mod. Off hides /keepwarm and stops any active keep-warm.'
                      : mod.kind === 'panel'
                        ? "Operant's own panel. Uses Operant's hook events; no model calls."
                        : 'A native Claude Code mod (plugin/mods/' + mod.id + '). Loaded into Claude Code when a tile starts.'
                }
                htmlFor={`mod-${mod.id}`}
              >
                <Switch id={`mod-${mod.id}`} checked={on} disabled={(!chat && !m.enabled) || !!unavailable} onCheckedChange={(v) => (chat ? setMods(mod.id === 'commandMenu' ? { commandMenu: v } : { keepWarm: v }) : setMods({ mods: { ...m.mods, [mod.id as ModId]: v } }))} />
              </Row>
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dictation</CardTitle>
          <CardDescription>The microphone button in the Chat composer. Speech is turned into text on this device.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="Enable dictation" hint="Off hides the microphone button and the dictation shortcut does nothing." htmlFor="dictation-enabled">
            <Switch id="dictation-enabled" checked={s.dictation.enabled} onCheckedChange={(v) => save.mutate({ dictation: { enabled: v } })} />
          </Row>
          <Row label="Hold to talk" hint="On: record only while the shortcut is held down, and transcribe when you let go. Off: press once to start and again to stop." htmlFor="dictation-hold">
            <Switch id="dictation-hold" checked={s.dictation.mode === 'hold'} onCheckedChange={(v) => save.mutate({ dictation: { mode: v ? 'hold' : 'toggle' } })} />
          </Row>
          <Row label="Shortcut" hint="Change it in Shortcuts. A key combination or the middle, back or forward mouse button.">
            <kbd className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{formatAccel(s.keybinds.dictate)}</kbd>
          </Row>
          <Row label="Speech model" hint={installError ?? installItem('dictation').enables}>
            <div className="flex items-center gap-2">
              <Badge variant={speech?.state === 'installed' ? 'secondary' : 'outline'}>{statusLabel(speech)}</Badge>
              <Button size="sm" variant="outline" aria-label="Install Dictation speech model" disabled={installing || speech?.state === 'installed'} onClick={() => setConfirm(true)}>
                {installing && <Loader2 className="animate-spin" />}
                {installing ? 'Installing' : 'Install'}
              </Button>
            </div>
          </Row>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirm}
        title="Install Dictation speech model?"
        description={<p>{commandText('dictation', platform)}</p>}
        confirmLabel="Run the install"
        testId="install-confirm"
        onConfirm={async () => {
          setConfirm(false)
          setInstalling(true)
          setInstallError(null)
          const r = await run.mutateAsync('dictation')
          setInstalling(false)
          if (!r.ok) setInstallError(r.error)
        }}
        onCancel={() => setConfirm(false)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tile info bar</CardTitle>
          <CardDescription>
            The thin row under each terminal tile: model, context, tokens, cost, folder and branch. A value Operant cannot observe shows as n/a.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="Show the info bar" htmlFor="info-bar">
            <Switch id="info-bar" checked={s.infoBar} onCheckedChange={(v) => save.mutate({ infoBar: v })} />
          </Row>
          <Row label="Context warning" hint="The context bar turns amber from this percent (1 to 100)." htmlFor="context-warn">
            <NumberField id="context-warn" value={s.contextWarnPct} min={1} max={100} onCommit={(n) => save.mutate({ contextWarnPct: n })} />
          </Row>
          <Row label="Context danger" hint="The context bar turns red from this percent (1 to 100)." htmlFor="context-danger">
            <NumberField id="context-danger" value={s.contextDangerPct} min={1} max={100} onCommit={(n) => save.mutate({ contextDangerPct: n })} />
          </Row>
        </CardContent>
      </Card>
    </>
  )
}
