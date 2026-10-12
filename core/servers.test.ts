import { describe, expect, it } from 'vitest'
import { listServers } from './servers'

const label = () => ({ tileTitle: 'Shell', crewId: 1, crewName: 'App' })
const ok = (stdout: string) => ({ code: 0, stdout, stderr: '' })

describe('listServers', () => {
  it('reads netstat and the process csv on Windows', async () => {
    const r = await listServers([{ scratchId: 1, pid: 10 }], label, 'win32', async (cmd) =>
      cmd === 'netstat'
        ? ok('  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       11\n')
        : ok('"ProcessId","ParentProcessId","Name"\n"10","1","pwsh.exe"\n"11","10","node.exe"\n'),
    )
    expect(r.servers.map((s) => [s.port, s.process, s.allInterfaces])).toEqual([[5173, 'node', true]])
  })
  it('uses ss then falls back to lsof on Linux', async () => {
    const r = await listServers([{ scratchId: 1, pid: 10 }], label, 'linux', async (cmd) => {
      if (cmd === 'ps') return ok('10 1 bash\n11 10 node\n')
      if (cmd === 'ss') return { code: 127, stdout: '', stderr: 'not found' }
      return ok('COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\nnode 11 me 20u IPv4 0x1 0t0 TCP 127.0.0.1:3000 (LISTEN)\n')
    })
    expect(r.servers.map((s) => s.url)).toEqual(['http://localhost:3000'])
  })
  it('treats lsof finding nothing as an empty list, and a failed command as an error', async () => {
    const empty = await listServers([{ scratchId: 1, pid: 10 }], label, 'darwin', async (cmd) => (cmd === 'ps' ? ok('10 1 zsh\n') : { code: 1, stdout: '', stderr: '' }))
    expect(empty).toEqual({ servers: [] })
    const bad = await listServers([{ scratchId: 1, pid: 10 }], label, 'darwin', async () => ({ code: 2, stdout: '', stderr: 'boom' }))
    expect(bad.error).toMatch(/failed/)
  })
  it('does not run anything without tiles', async () => {
    const r = await listServers([], label, 'linux', async () => {
      throw new Error('should not run')
    })
    expect(r).toEqual({ servers: [] })
  })
})
