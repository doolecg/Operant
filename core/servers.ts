import { buildServers, parseLsof, parseNetstat, parseProcCsv, parsePs, parseSs, type ListenSocket, type ProcInfo, type RunningServer, type ServersResult, type TileLabel, type TileRoot } from '../shared/servers'
import { runHidden, type RunResult } from './proc'

type Run = (cmd: string, args: string[]) => Promise<RunResult>

const TIMEOUT_MS = 8000

const run: Run = (cmd, args) => runHidden(cmd, args, { timeoutMs: TIMEOUT_MS, quiet: true })

const POWERSHELL = ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Csv -NoTypeInformation']

// The listening TCP sockets and the process list of this machine, read without a console window or elevation.
// Windows: netstat and PowerShell's CIM query. macOS: lsof and ps. Linux: ss (lsof when ss is missing) and ps.
export async function readListeners(platform: NodeJS.Platform = process.platform, exec: Run = run): Promise<{ sockets: ListenSocket[]; procs: ProcInfo[] }> {
  if (platform === 'win32') {
    const [net, ps] = await Promise.all([exec('netstat', ['-ano', '-p', 'tcp']), exec('powershell.exe', POWERSHELL)])
    if (net.code !== 0) throw new Error(`netstat failed${net.stderr ? `: ${net.stderr.trim()}` : ''}`)
    if (ps.code !== 0) throw new Error(`PowerShell could not list processes${ps.stderr ? `: ${ps.stderr.trim()}` : ''}`)
    return { sockets: parseNetstat(net.stdout), procs: parseProcCsv(ps.stdout) }
  }
  const [ps, sockets] = await Promise.all([exec('ps', ['-A', '-o', 'pid=,ppid=,comm=']), listPosix(platform, exec)])
  if (ps.code !== 0) throw new Error(`ps failed${ps.stderr ? `: ${ps.stderr.trim()}` : ''}`)
  return { sockets, procs: parsePs(ps.stdout) }
}

async function listPosix(platform: NodeJS.Platform, exec: Run): Promise<ListenSocket[]> {
  if (platform === 'linux') {
    const ss = await exec('ss', ['-ltnp'])
    if (ss.code === 0) return parseSs(ss.stdout)
  }
  const lsof = await exec('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'])
  // lsof exits 1 when nothing listens; that is an empty list, not a failure.
  if (lsof.code === 0 || (lsof.code === 1 && !lsof.stderr.trim())) return parseLsof(lsof.stdout)
  throw new Error(platform === 'linux' ? 'Neither ss nor lsof could list listening ports' : `lsof failed${lsof.stderr ? `: ${lsof.stderr.trim()}` : ''}`)
}

export async function listServers(
  roots: TileRoot[],
  label: (scratchId: number) => TileLabel | null,
  platform: NodeJS.Platform = process.platform,
  exec: Run = run,
): Promise<ServersResult> {
  if (roots.length === 0) return { servers: [] }
  try {
    const { sockets, procs } = await readListeners(platform, exec)
    const servers: RunningServer[] = buildServers(sockets, procs, roots, label)
    return { servers }
  } catch (e) {
    return { servers: [], error: e instanceof Error ? e.message : String(e) }
  }
}
