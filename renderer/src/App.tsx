import { useEffect, useState } from 'react'
import { Bot, PanelLeft, Plus, Settings, Terminal } from 'lucide-react'
import { ConsoleDrawer } from '@/components/console/ConsoleDrawer'
import { useConsole } from '@/components/console/useConsole'
import { DeleteCrewDialog, EditCrewDialog, NewCrewDialog } from '@/components/dashboard/Dialogs'
import { GitChangesDialog } from '@/components/dashboard/GitChangesDialog'
import { GitDialog } from '@/components/git/GitDialog'
import { projectActions } from '@/components/dashboard/projectActions'
import { useTerminals } from '@/components/terminal/useTerminals'
import { useWaitingTiles } from '@/components/terminal/useWaitingTiles'
import { Toaster } from '@/components/ui/toaster'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { TerminalView } from '@/components/terminal/TerminalView'
import { OPEN_SETTINGS_EVENT } from '@/components/memory/LearningBadge'
import { ServersPopover } from '@/components/dashboard/ServersPopover'
import { ProviderLimitBadge } from '@/components/cost/ProviderBadge'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { iconBtn } from '@/components/topbar/pill'
import { ClockPill } from '@/components/topbar/ClockPill'
import { OPEN_CHANGES_EVENT } from '@/components/chat/ChangedFilesCard'
import { GitChip } from '@/components/topbar/GitChip'
import { MediaBar } from '@/components/topbar/MediaBar'
import { ProjectBlock } from '@/components/topbar/ProjectBlock'
import { ModeToggles } from '@/components/topbar/ModeToggles'
import { CliSelect } from '@/components/topbar/CliSelect'
import { ActivityMenu } from '@/components/topbar/ActivityMenu'
import { UsageDialog } from '@/components/cost/UsageDialog'
import { useBarTier } from '@/components/topbar/useBarTier'
import { mediaCommand } from '@/components/topbar/useMedia'
import { matches, matchesMouseEvent, swallowBoundMouse } from '@/lib/keys'
import { effectiveScale, stepScale, useUiScale } from '@/lib/uiScale'
import { useAction, useCrews, useIndexStatus, useLiveUpdates, useMoveToGroup, useSaveSettings, useSettings } from '@/lib/queries'
import { bridge } from '@/lib/bridge'
import { CloseAppDialog } from '@/components/terminal/CloseAppDialog'
import { LearnOnCloseDialog } from '@/components/memory/LearnOnCloseDialog'
import { SetupDialog } from '@/components/setup/SetupDialog'
import { useCloseTile } from '@/components/terminal/useCloseTile'
import type { Crew } from '@shared/types'
import type { MainCli } from '@shared/settings'

const LAST_CREW = 'operant.lastCrew'

const Divider = () => <span aria-hidden className="bg-border h-5 w-px shrink-0" />

function readLastCrew(): number | null {
  try {
    const v = localStorage.getItem(LAST_CREW)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

export function App() {
  useLiveUpdates()
  const crews = useCrews()
  const [crewId, setCrewId] = useState<number | null>(readLastCrew)
  const [newCrew, setNewCrew] = useState(false)
  const [crewDialog, setCrewDialog] = useState<'edit' | 'delete' | null>(null)
  const [page, setPage] = useState<'dashboard' | 'settings'>('dashboard')
  const [settingsSection, setSettingsSection] = useState<string | undefined>()
  const [consoleOpen, setConsoleOpen] = useState(false)
  const bgConsole = useConsole(consoleOpen)
  // The project a new project is added to (from a group's "+"), the project a delete or changes dialog is about.
  const [newCrewGroup, setNewCrewGroup] = useState<number | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Crew | null>(null)
  const [changesTarget, setChangesTarget] = useState<Crew | null>(null)
  const moveToGroup = useMoveToGroup()
  const [barRef, tier] = useBarTier()
  const [cliOpen, setCliOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [gitOpen, setGitOpen] = useState(false)
  // The Welcome screen shows while there is no project, until the Playground has been opened.
  const [playgroundSeen, setPlaygroundSeen] = useState(false)

  // Fall back to the first crew when the remembered one is gone.
  useEffect(() => {
    const list = crews.data
    if (!list) return
    if (crewId == null || !list.some((r) => r.id === crewId)) setCrewId((list.find((r) => r.kind !== 'playground') ?? list[0])?.id ?? null)
  }, [crews.data, crewId])

  // The small memory button next to the context readout opens its settings page.
  useEffect(() => {
    const open = (e: Event) => openSettingsAt((e as CustomEvent<string>).detail)
    window.addEventListener(OPEN_SETTINGS_EVENT, open)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open)
  }, [])

  // "Open diff" on a chat's changed-files card.
  useEffect(() => {
    const open = () => setGitOpen(true)
    window.addEventListener(OPEN_CHANGES_EVENT, open)
    return () => window.removeEventListener(OPEN_CHANGES_EVENT, open)
  }, [])

  useEffect(() => {
    try {
      if (crewId != null) localStorage.setItem(LAST_CREW, String(crewId))
    } catch {
      /* storage unavailable */
    }
  }, [crewId])

  const index = useIndexStatus(crewId)
  const runIndex = useAction('index:run')
  const settings = useSettings()
  const saveSettings = useSaveSettings()
  useUiScale(settings.data?.uiScale)
  const terminals = useTerminals(crews.data, settings.data?.defaultModels.claude ?? 'sonnet', settings.data?.mainCli ?? 'claude', settings.data?.defaultEfforts.claude ?? '')

  const crew = crews.data?.find((c) => c.id === crewId)
  const layout = settings.data?.layout
  const sidebarHidden = layout?.sidebarHidden ?? false
  const notesOpen = layout?.notesOpen ?? false
  const setLayout = (patch: Partial<NonNullable<typeof layout>>) => saveSettings.mutate({ layout: patch })
  const projectScratch = terminals.tabs.filter((t) => t.crewId === crewId)
  const waitingTiles = useWaitingTiles()
  const waitingCrews = new Set(terminals.tabs.filter((t) => waitingTiles.has(t.scratchId)).map((t) => t.crewId))
  const closeTile = useCloseTile(terminals.tabs, settings.data?.confirm.closeTile ?? true, terminals.closeTab)
  // A Windows notification was clicked: show that Claude tile.
  useEffect(
    () =>
      bridge().on('notify:open', ({ scratchId, crewId: target }) => {
        setCrewId(target)
        setPage('dashboard')
        terminals.setActive(scratchId)
      }),
    [],
  )
  const tb = settings.data?.topBar

  // Once the bar is narrow, the terminal CLI pick moves into a menu next to the view switcher.
  const cliMenu = (
    <DropdownMenu open={cliOpen} onOpenChange={setCliOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" className={iconBtn} aria-label="Terminal CLI">
              <Bot />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Terminal CLI</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" aria-label="Terminal CLI" className="w-auto p-2">
        <div className="flex flex-col items-start gap-1.5" onClick={() => setCliOpen(false)}>
          <CliSelect />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const openSettingsAt = (section?: string) => (setSettingsSection(section), setPage('settings'))
  const projectMenu = {
    newCli: (c: Crew, cli: MainCli) => void terminals.openTab(c, cli),
    newShell: (c: Crew) => void terminals.openTab(c, 'shell'),
    openIde: (c: Crew) => void projectActions.openIde(c),
    openFolder: (c: Crew) => void projectActions.openFolder(c),
    index: (c: Crew) => void projectActions.index(c),
    changes: (c: Crew) => setChangesTarget(c),
    copyPath: (c: Crew) => void projectActions.copyPath(c),
    defaults: () => openSettingsAt('projects'),
    remove: (c: Crew) => setDeleteTarget(c),
    openPlayground: () => {
      const pg = crews.data?.find((c) => c.kind === 'playground')
      if (!pg) return
      setCrewId(pg.id)
      setPlaygroundSeen(true)
      setPage('dashboard')
    },
  }

  // Rebindable shortcuts from Settings; dialogs and the key recorder take keys first.
  useEffect(() => {
    const binds = settings.data?.keybinds
    const uiScale = settings.data?.uiScale ?? 0
    if (!binds) return
    const dash = () => setPage('dashboard')
    const actions: Array<[string, () => void]> = [
        [binds.newCrew, () => (dash(), setNewCrew(true))],
        [binds.indexCrew, () => crewId != null && runIndex.mutate([crewId])],
        [binds.openSettings, () => setPage((v) => (v === 'settings' ? 'dashboard' : 'settings'))],
        [binds.toggleConsole, () => setConsoleOpen((v) => !v)],
        [binds.newShell, () => crew && (dash(), void terminals.openTab(crew, 'shell'))],
        [binds.toggleSidebar, () => setLayout({ sidebarHidden: !sidebarHidden })],
        [binds.toggleAllPanels, () => setLayout({ sidebarHidden: !sidebarHidden })],
        [binds.toggleNotes, () => setLayout({ notesOpen: !notesOpen })],
        [binds.openInIde, () => crew && void projectActions.openIde(crew)],
        [binds.openPlayground, () => projectMenu.openPlayground()],
        [binds.mediaPlayPause, () => mediaCommand('toggle')],
        [binds.mediaNext, () => mediaCommand('next')],
        [binds.mediaPrev, () => mediaCommand('prev')],
        [binds.mediaShuffle, () => mediaCommand('shuffle')],
        [binds.zoomIn, () => saveSettings.mutate({ uiScale: stepScale(effectiveScale(uiScale), 1) })],
        [binds.zoomOut, () => saveSettings.mutate({ uiScale: stepScale(effectiveScale(uiScale), -1) })],
        [binds.zoomReset, () => saveSettings.mutate({ uiScale: 0 })],
    ]
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const hit = actions.find(([accel]) => matches(e, accel))
      if (!hit) return
      e.preventDefault()
      hit[1]()
    }
    const onMouse = (e: MouseEvent) => {
      const hit = actions.find(([accel]) => matchesMouseEvent(e, accel))
      if (!hit) return
      e.preventDefault()
      hit[1]()
    }
    const unswallow = swallowBoundMouse(Object.values(binds))
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onMouse)
      unswallow()
    }
  }, [settings.data?.keybinds, settings.data?.uiScale, saveSettings, crewId, runIndex, crew, terminals.openTab, crews.data, sidebarHidden, notesOpen])

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
      <header ref={barRef} className="bg-background/80 grid h-[38px] shrink-0 grid-cols-[minmax(auto,1fr)_auto_minmax(auto,1fr)] items-center gap-3 border-b px-3 text-xs backdrop-blur">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className={iconBtn} aria-label={sidebarHidden ? 'Show project list' : 'Hide project list'} aria-pressed={!sidebarHidden} onClick={() => setLayout({ sidebarHidden: !sidebarHidden })}>
                <PanelLeft />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">{sidebarHidden ? 'Show project list' : 'Hide project list'} (Alt+B)</TooltipContent>
          </Tooltip>
          <div className="flex shrink-0 items-center gap-2">
            <span aria-hidden className="text-[20px] leading-none text-[#d97757]">
              ◈
            </span>
            {tier < 3 && <span className="text-[13px] font-semibold whitespace-nowrap">Operant 3</span>}
          </div>
          {crew && (
            <>
              <Divider />
              <ProjectBlock
                crew={crew}
                indexed={!!index.data?.initialized}
                indexing={!!index.data?.indexing || runIndex.isPending}
                onIndex={() => runIndex.mutate([crew.id])}
                onIde={() => projectMenu.openIde(crew)}
                onShell={() => projectMenu.newShell(crew)}
                onAgent={() => projectMenu.newCli(crew, settings.data?.mainCli ?? 'claude')}
                onEdit={() => setCrewDialog('edit')}
                onDelete={() => setCrewDialog('delete')}
              />
              <ModeToggles crew={crew} tier={tier} />
            </>
          )}
          <Divider />
          {tier < 7 && <CliSelect />}
          {tier >= 7 && cliMenu}
        </div>
        <div className="flex shrink-0 justify-center">{tb && tier < 6 && <ClockPill format={tb.clockFormat} seconds={tb.clockSeconds} date={tb.clockDate && tier < 2} />}</div>
        <div className="flex items-center justify-end gap-1.5">
          {tb?.mediaControls && tier < 5 && <MediaBar enabled size={tb.mediaSize} tier={tier} />}
          <ActivityMenu crewId={crewId} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className={iconBtn} aria-label="Settings" onClick={() => openSettingsAt()}>
                <Settings />
              </button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        {!sidebarHidden && (
          <Sidebar
            crews={crews.data ?? []}
            selected={page === 'dashboard' ? crewId : null}
            onSelect={(id) => (setCrewId(id), setPage('dashboard'), crews.data?.find((c) => c.id === id)?.kind === 'playground' && setPlaygroundSeen(true))}
            onNewCrew={(groupId) => (setNewCrewGroup(groupId), setNewCrew(true))}
            actions={projectMenu}
            waiting={waitingCrews}
            footer={
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Settings" aria-pressed={page === 'settings'} onClick={() => openSettingsAt()}>
                      <Settings />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings (Ctrl+,)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="relative"
                      aria-label={bgConsole.errors > 0 ? `Console, ${bgConsole.errors} new errors` : 'Console'}
                      aria-pressed={consoleOpen}
                      onClick={() => setConsoleOpen((v) => !v)}
                    >
                      <Terminal />
                      {bgConsole.errors > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white">
                          {bgConsole.errors > 99 ? '99+' : bgConsole.errors}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Console (Ctrl+J)</TooltipContent>
                </Tooltip>
                <ServersPopover onOpened={(id) => (setCrewId(id), setPage('dashboard'))} />
                <ProviderLimitBadge onOpen={() => (setPage('dashboard'), setUsageOpen(true))} />
                <GitChip crewId={crewId} compact onOpen={() => setGitOpen(true)} />
              </>
            }
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {page === 'settings' ? (
            <div className="surface min-h-0 flex-1 m-1.5 overflow-hidden"><SettingsPage initialSection={settingsSection} onClose={() => setPage('dashboard')} /></div>
          ) : crews.data && !playgroundSeen && crews.data.every((c) => c.kind === 'playground') ? (
            <div className="surface min-h-0 flex-1 m-1.5 overflow-hidden"><Welcome onNewCrew={() => setNewCrew(true)} /></div>
          ) : (
            <div className="min-h-0 flex-1">
              {crewId != null && (
                <TerminalView
                  crewId={crewId}
                  scratch={projectScratch}
                  active={terminals.active}
                  onCloseScratch={closeTile.request}
                  onStart={(kind) => crew && void terminals.openTab(crew, kind)}
                />
              )}
            </div>
          )}
          {consoleOpen && (
            <ConsoleDrawer
              lines={bgConsole.lines}
              processes={bgConsole.processes}
              onClear={bgConsole.clear}
              onStop={bgConsole.stop}
              onClose={() => setConsoleOpen(false)}
            />
          )}
        </main>
      </div>
      </div>

      <NewCrewDialog
        open={newCrew}
        onOpenChange={(o) => (setNewCrew(o), !o && setNewCrewGroup(undefined))}
        onCreated={(id) => {
          setCrewId(id)
          setPage('dashboard')
          if (newCrewGroup != null) moveToGroup.mutate([id, newCrewGroup])
        }}
      />
      {crew && crewDialog === 'edit' && <EditCrewDialog crew={crew} open onOpenChange={(o) => !o && setCrewDialog(null)} />}
      {crew && crewDialog === 'delete' && (
        <DeleteCrewDialog
          crewId={crew.id}
          crewName={crew.name}
          open
          onOpenChange={(o) => !o && setCrewDialog(null)}
          onDeleted={() => terminals.dropCrew(crew.id)}
        />
      )}
      {deleteTarget && (
        <DeleteCrewDialog
          crewId={deleteTarget.id}
          crewName={deleteTarget.name}
          open
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          onDeleted={() => terminals.dropCrew(deleteTarget.id)}
        />
      )}
      {changesTarget && (
        <GitChangesDialog
          crew={changesTarget}
          onClose={() => setChangesTarget(null)}
          onOpenPage={(c) => (setCrewId(c.id), setPage('dashboard'), setGitOpen(true))}
        />
      )}
      {crewId != null && <UsageDialog crewId={crewId} open={usageOpen} onOpenChange={setUsageOpen} />}
      {crewId != null && <GitDialog crewId={crewId} open={gitOpen} onOpenChange={setGitOpen} />}
      {closeTile.dialog}
      <CloseAppDialog />
      <LearnOnCloseDialog />
      <SetupDialog />
      <Toaster />
    </TooltipProvider>
  )
}

function Welcome({ onNewCrew }: { onNewCrew: () => void }) {
  return (
    <div className="grid h-full place-items-center p-10">
      <div className="max-w-md space-y-4 text-center">
        <div aria-hidden className="text-[#d97757] text-5xl leading-none">
          ◈
        </div>
        <h1 className="text-2xl font-semibold">Welcome to Operant 3</h1>
        <p className="text-muted-foreground text-sm">
          Add a project folder, open shells and coding agents in it, and keep its lessons, usage and git changes in one place.
        </p>
        <Button onClick={onNewCrew}>
          <Plus /> Add your first project
        </Button>
      </div>
    </div>
  )
}
