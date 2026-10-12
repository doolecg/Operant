import { describe, expect, it } from 'vitest'
import { buildServers, clickableAddress, descendantsOf, looksLikeServerStart, parseLsof, parseNetstat, parseProcCsv, parsePs, parseSs } from './servers'

const NETSTAT = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1088
  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       4200
  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       4300
  TCP    127.0.0.1:3000         127.0.0.1:50211        ESTABLISHED     4300
  TCP    [::]:5173              [::]:0                 ABHÖREN         4200
  TCP    [::1]:8080             [::]:0                 LISTENING       4300
`

const LSOF = `COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    41001 me   23u  IPv4 0x1234567890      0t0  TCP *:3000 (LISTEN)
node    41001 me   24u  IPv6 0x1234567891      0t0  TCP [::1]:5173 (LISTEN)
Google\\x20Chrome 500 me 40u IPv4 0x1 0t0 TCP 127.0.0.1:9222 (LISTEN)
node    41001 me   25u  IPv4 0x12      0t0  TCP 127.0.0.1:3000->127.0.0.1:5000 (ESTABLISHED)
`

const SS = `State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
LISTEN 0      511        127.0.0.1:3000      0.0.0.0:*     users:(("node",pid=7001,fd=20))
LISTEN 0      511                *:8080            *:*     users:(("python3",pid=7002,fd=3))
LISTEN 0      4096   127.0.0.53%lo:53        0.0.0.0:*
LISTEN 0      128             [::]:22            [::]:*
`

const PS = `    1     0 init
 7000     1 bash
 7001  7000 node
 7002  7000 /usr/bin/python3
 9000     1 other
`

const CSV = `"ProcessId","ParentProcessId","Name"
"4000","1","powershell.exe"
"4200","4000","node.exe"
"4300","4200","esbuild.exe"
"1088","4","svchost.exe"
`

describe('parsers', () => {
  it('reads netstat listening rows in any language', () => {
    const s = parseNetstat(NETSTAT)
    expect(s.map((x) => `${x.pid}@${x.address}:${x.port}`)).toEqual(['1088@0.0.0.0:135', '4200@0.0.0.0:5173', '4300@127.0.0.1:3000', '4200@[::]:5173', '4300@[::1]:8080'])
  })
  it('reads lsof listening rows only', () => {
    const s = parseLsof(LSOF)
    expect(s).toEqual([
      { pid: 41001, address: '*', port: 3000, name: 'node' },
      { pid: 41001, address: '[::1]', port: 5173, name: 'node' },
      { pid: 500, address: '127.0.0.1', port: 9222, name: 'Google Chrome' },
    ])
  })
  it('reads ss rows with their pids', () => {
    const s = parseSs(SS)
    expect(s).toEqual([
      { pid: 7001, address: '127.0.0.1', port: 3000, name: 'node' },
      { pid: 7002, address: '*', port: 8080, name: 'python3' },
    ])
  })
  it('reads ps and the Windows process csv', () => {
    expect(parsePs(PS)).toContainEqual({ pid: 7002, ppid: 7000, name: 'python3' })
    expect(parseProcCsv(CSV)).toEqual([
      { pid: 4000, ppid: 1, name: 'powershell' },
      { pid: 4200, ppid: 4000, name: 'node' },
      { pid: 4300, ppid: 4200, name: 'esbuild' },
      { pid: 1088, ppid: 4, name: 'svchost' },
    ])
  })
})

describe('addresses', () => {
  it('maps bind addresses to a clickable one', () => {
    expect(clickableAddress('0.0.0.0', 5173)).toEqual({ url: 'http://localhost:5173', allInterfaces: true })
    expect(clickableAddress('*', 1)).toEqual({ url: 'http://localhost:1', allInterfaces: true })
    expect(clickableAddress('[::]', 80)).toEqual({ url: 'http://localhost:80', allInterfaces: true })
    expect(clickableAddress('127.0.0.1', 3000)).toEqual({ url: 'http://localhost:3000', allInterfaces: false })
    expect(clickableAddress('::1', 3000)).toEqual({ url: 'http://localhost:3000', allInterfaces: false })
    expect(clickableAddress('192.168.1.5', 3000)).toEqual({ url: 'http://192.168.1.5:3000', allInterfaces: false })
  })
})

describe('process tree and rows', () => {
  const procs = parseProcCsv(CSV)
  it('finds every descendant of a root', () => {
    const owner = descendantsOf([{ scratchId: 1, pid: 4000 }], procs)
    expect([...owner.keys()].sort()).toEqual([4000, 4200, 4300])
  })
  it('survives a parent loop', () => {
    const owner = descendantsOf([{ scratchId: 1, pid: 1 }], [{ pid: 1, ppid: 2, name: 'a' }, { pid: 2, ppid: 1, name: 'b' }])
    expect(owner.size).toBe(2)
  })
  it('keeps only sockets inside a tile, one row per pid and port', () => {
    const rows = buildServers(parseNetstat(NETSTAT), procs, [{ scratchId: 7, pid: 4000 }], (id) => (id === 7 ? { tileTitle: 'Shell', crewId: 2, crewName: 'App' } : null))
    expect(rows.map((r) => [r.port, r.process, r.url, r.allInterfaces])).toEqual([
      [3000, 'esbuild', 'http://localhost:3000', false],
      [5173, 'node', 'http://localhost:5173', true],
      [8080, 'esbuild', 'http://localhost:8080', false],
    ])
    expect(rows[0]).toMatchObject({ scratchId: 7, crewId: 2, crewName: 'App', tileTitle: 'Shell', pid: 4300 })
  })
  it('drops rows of tiles that no longer exist', () => {
    expect(buildServers(parseNetstat(NETSTAT), procs, [{ scratchId: 7, pid: 4000 }], () => null)).toEqual([])
  })
})

describe('output hint', () => {
  it('spots a server announcing itself', () => {
    expect(looksLikeServerStart('  \u001b[32m➜\u001b[0m  Local:   http://localhost:5173/')).toBe(true)
    expect(looksLikeServerStart('Listening on port 3000')).toBe(true)
    expect(looksLikeServerStart('ready on 0.0.0.0:8080')).toBe(true)
    expect(looksLikeServerStart('compiled 12 modules')).toBe(false)
  })
})
