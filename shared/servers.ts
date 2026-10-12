// Dev servers started from a project's tiles: parsing of the listening sockets and the process list of each OS, and
// the pure steps that turn them into rows. No Electron and no spawning here (core/servers.ts runs the commands).

export interface ListenSocket {
  pid: number
  // The bind address as the OS reports it ('*', '0.0.0.0', '[::]', '127.0.0.1', '::1', a LAN address).
  address: string
  port: number
  // The process name when the command that listed the sockets also gave it (lsof, ss).
  name?: string
}

export interface ProcInfo {
  pid: number
  ppid: number
  name: string
}

// A tile's process: the pty shell of a terminal tile, or the claude process of a Chat view tile.
export interface TileRoot {
  scratchId: number
  pid: number
}

export interface RunningServer {
  // Stable per pid and port.
  key: string
  url: string
  port: number
  pid: number
  process: string
  scratchId: number
  tileTitle: string
  crewId: number
  crewName: string
  // Bound to every interface, so other machines on the network can reach it.
  allInterfaces: boolean
}

export interface ServersResult {
  servers: RunningServer[]
  // Why the list could not be read (the OS command failed); the list is then empty.
  error?: string
}

const toPort = (s: string): number => {
  const n = Number(s)
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 0
}

// Splits "host:port" where the host may be an IPv6 address in brackets or bare. Port 0 gives null.
function splitHostPort(text: string): { host: string; port: number } | null {
  const i = text.lastIndexOf(':')
  if (i < 0) return null
  const port = toPort(text.slice(i + 1))
  if (!port) return null
  return { host: text.slice(0, i), port }
}

function baseName(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.exe$/i, '')
}

// Windows: `netstat -ano -p tcp`. A listening row has a foreign address ending in :0, which holds in every language
// (the state word itself is translated).
export function parseNetstat(text: string): ListenSocket[] {
  const out: ListenSocket[] = []
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/)
    if (f.length < 5 || f[0]?.toUpperCase() !== 'TCP') continue
    const local = splitHostPort(f[1] ?? '')
    const pid = Number(f[f.length - 1])
    if (!local || !Number.isInteger(pid) || pid <= 0) continue
    if (!/:0$/.test(f[2] ?? '')) continue
    out.push({ pid, address: local.host, port: local.port })
  }
  return out
}

// macOS and Linux: `lsof -nP -iTCP -sTCP:LISTEN`.
export function parseLsof(text: string): ListenSocket[] {
  const out: ListenSocket[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\S+)\s+(\d+)\s+.*\sTCP\s+(\S+)\s+\(LISTEN\)/.exec(line)
    if (!m) continue
    const hp = splitHostPort(m[3] ?? '')
    if (!hp) continue
    out.push({ pid: Number(m[2]), address: hp.host, port: hp.port, name: (m[1] ?? '').replace(/\\x20/g, ' ') })
  }
  return out
}

// Linux: `ss -ltnp`. Without privileges it lists the user's own processes, which is what is wanted.
export function parseSs(text: string): ListenSocket[] {
  const out: ListenSocket[] = []
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/)
    if (f[0] !== 'LISTEN' || f.length < 5) continue
    const pids = [...line.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]))
    const local = splitHostPort(f[3] ?? '')
    if (!local || pids.length === 0) continue
    // 0.0.0.0%lo:53 names the interface after the address.
    const host = local.host.replace(/%.*$/, '')
    const name = /\(\("([^"]+)"/.exec(line)?.[1]
    for (const pid of new Set(pids)) out.push({ pid, address: host, port: local.port, ...(name ? { name } : {}) })
  }
  return out
}

// macOS and Linux: `ps -A -o pid=,ppid=,comm=`.
export function parsePs(text: string): ProcInfo[] {
  const out: ProcInfo[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line)
    if (!m) continue
    out.push({ pid: Number(m[1]), ppid: Number(m[2]), name: baseName(m[3] ?? '') })
  }
  return out
}

// Windows: Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Csv.
export function parseProcCsv(text: string): ProcInfo[] {
  const out: ProcInfo[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^"?(\d+)"?,"?(\d+)"?,"?(.*?)"?\s*$/.exec(line.trim())
    if (!m) continue
    out.push({ pid: Number(m[1]), ppid: Number(m[2]), name: baseName(m[3] ?? '') })
  }
  return out
}

// Every process under one of the roots (the root included), mapped to the root it belongs to. A process already
// claimed keeps its first claim, so a parent loop cannot hang it.
export function descendantsOf(roots: TileRoot[], procs: ProcInfo[]): Map<number, TileRoot> {
  const children = new Map<number, number[]>()
  for (const p of procs) {
    const list = children.get(p.ppid)
    if (list) list.push(p.pid)
    else children.set(p.ppid, [p.pid])
  }
  const owner = new Map<number, TileRoot>()
  for (const root of roots) {
    const stack = [root.pid]
    while (stack.length) {
      const pid = stack.pop() as number
      if (owner.has(pid)) continue
      owner.set(pid, root)
      for (const c of children.get(pid) ?? []) stack.push(c)
    }
  }
  return owner
}

const ALL_V4 = new Set(['0.0.0.0', '*'])
const ALL_V6 = new Set(['::', '[::]'])
const LOOPBACK = new Set(['localhost', '::1', '[::1]'])

// The address to open for a socket bound to `bind`, and whether other machines can reach it.
export function clickableAddress(bind: string, port: number): { url: string; allInterfaces: boolean } {
  const host = bind.trim()
  if (ALL_V4.has(host) || ALL_V6.has(host)) return { url: `http://localhost:${port}`, allInterfaces: true }
  if (LOOPBACK.has(host) || /^127\./.test(host)) return { url: `http://localhost:${port}`, allInterfaces: false }
  const shown = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return { url: `http://${shown}:${port}`, allInterfaces: false }
}

export interface TileLabel {
  tileTitle: string
  crewId: number
  crewName: string
}

// The listening sockets inside the tiles' process trees, one row per pid and port, sorted by project then port.
export function buildServers(
  sockets: ListenSocket[],
  procs: ProcInfo[],
  roots: TileRoot[],
  label: (scratchId: number) => TileLabel | null,
): RunningServer[] {
  const owner = descendantsOf(roots, procs)
  const names = new Map(procs.map((p) => [p.pid, p.name]))
  const rows = new Map<string, RunningServer>()
  for (const s of sockets) {
    const root = owner.get(s.pid)
    if (!root) continue
    const tile = label(root.scratchId)
    if (!tile) continue
    const key = `${s.pid}:${s.port}`
    const addr = clickableAddress(s.address, s.port)
    const seen = rows.get(key)
    if (seen) {
      // The same port on IPv4 and IPv6 (or loopback and a LAN address): the more open binding wins.
      if (addr.allInterfaces || addr.url !== seen.url) seen.allInterfaces = true
      if (addr.url.startsWith('http://localhost:')) seen.url = addr.url
      continue
    }
    rows.set(key, {
      key,
      url: addr.url,
      port: s.port,
      pid: s.pid,
      process: names.get(s.pid) ?? (s.name ? baseName(s.name) : `pid ${s.pid}`),
      scratchId: root.scratchId,
      ...tile,
      allInterfaces: addr.allInterfaces,
    })
  }
  return [...rows.values()].sort((a, b) => a.crewName.localeCompare(b.crewName) || a.port - b.port)
}

// Terminal output that looks like a server announcing itself.
const SERVER_HINT = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):\d{2,5}|listening on|\bLocal:\s/i
const ESC = String.fromCharCode(27)
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, 'g')

export function looksLikeServerStart(chunk: string): boolean {
  return SERVER_HINT.test(chunk.replace(ANSI, ''))
}
