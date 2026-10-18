import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

// How to read a browser's cookie store, once detected.
export interface BrowserTarget {
  engine: 'firefox' | 'chromium' | 'unsupported'
  // Display name shown to the user.
  name: string
  // Firefox: the profile folder holding cookies.sqlite. Chromium: the profile folder holding Network/Cookies.
  profileDir: string
  // Chromium only: the "User Data" folder holding Local State (which carries the encryption key).
  userDataDir?: string
  // When unsupported, why.
  reason?: string
}

// Runs a command to completion and returns stdout, or '' on any failure. Supplied by the caller (core/proc.ts) so
// detection stays testable and every spawn goes through the hidden-window runner.
export type Run = (cmd: string, args: string[]) => Promise<string>

interface Family {
  engine: 'firefox' | 'chromium'
  name: string
}

// ---- Windows ----

// Maps the UserChoice ProgId for https to a browser family.
export function windowsFamilyFromProgId(progId: string): Family | null {
  const p = progId.toLowerCase()
  if (p.startsWith('firefoxurl')) return { engine: 'firefox', name: 'Firefox' }
  if (p.startsWith('librewolf')) return { engine: 'firefox', name: 'LibreWolf' }
  if (p.startsWith('zen')) return { engine: 'firefox', name: 'Zen' }
  if (p.startsWith('chromehtml')) return { engine: 'chromium', name: 'Google Chrome' }
  if (p.startsWith('msedge')) return { engine: 'chromium', name: 'Microsoft Edge' }
  if (p.startsWith('brave')) return { engine: 'chromium', name: 'Brave' }
  if (p.startsWith('vivaldi')) return { engine: 'chromium', name: 'Vivaldi' }
  if (p.startsWith('opera')) return { engine: 'chromium', name: 'Opera' }
  return null
}

// The folders a Windows browser keeps its profile and (Chromium) its User Data in.
function windowsLocations(name: string, env: NodeJS.ProcessEnv): { firefoxRoot?: string; userDataDir?: string } {
  const local = env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
  const roaming = env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  switch (name) {
    case 'Firefox':
      return { firefoxRoot: join(roaming, 'Mozilla', 'Firefox') }
    case 'LibreWolf':
      return { firefoxRoot: join(roaming, 'librewolf') }
    case 'Zen':
      return { firefoxRoot: join(roaming, 'zen') }
    case 'Google Chrome':
      return { userDataDir: join(local, 'Google', 'Chrome', 'User Data') }
    case 'Microsoft Edge':
      return { userDataDir: join(local, 'Microsoft', 'Edge', 'User Data') }
    case 'Brave':
      return { userDataDir: join(local, 'BraveSoftware', 'Brave-Browser', 'User Data') }
    case 'Vivaldi':
      return { userDataDir: join(local, 'Vivaldi', 'User Data') }
    case 'Opera':
      return { userDataDir: join(roaming, 'Opera Software', 'Opera Stable') }
    default:
      return {}
  }
}

// Pulls the ProgId out of `reg query` output.
export function parseRegProgId(out: string): string | null {
  const m = out.match(/ProgId\s+REG_SZ\s+(\S+)/i)
  return m ? (m[1] ?? null) : null
}

// ---- Firefox profiles.ini ----

// Finds the default profile's folder name in a profiles.ini. Prefers the [Install…] Default; falls back to the
// profile marked Default=1, then the first one.
export function defaultFirefoxProfilePath(iniText: string): string | null {
  const sections = iniText.split(/\r?\n(?=\[)/)
  let installDefault: string | null = null
  let legacyDefault: string | null = null
  let first: string | null = null
  for (const sec of sections) {
    const head = sec.match(/^\[([^\]]+)\]/)
    if (!head) continue
    const name = head[1] ?? ''
    const get = (k: string) => sec.match(new RegExp(`^${k}=(.*)$`, 'mi'))?.[1]?.trim()
    if (name.startsWith('Install')) {
      const d = get('Default')
      if (d) installDefault = d
    } else if (name.startsWith('Profile')) {
      const path = get('Path')
      if (!path) continue
      first ??= path
      if (get('Default') === '1') legacyDefault = path
    }
  }
  return installDefault ?? legacyDefault ?? first
}

function firefoxProfileDir(root: string): string | null {
  const ini = join(root, 'profiles.ini')
  if (!existsSync(ini)) return null
  let rel: string | null = null
  try {
    rel = defaultFirefoxProfilePath(readFileSync(ini, 'utf8'))
  } catch {
    return null
  }
  if (!rel) return null
  const dir = join(root, ...rel.split('/'))
  return existsSync(join(dir, 'cookies.sqlite')) ? dir : null
}

// ---- macOS ----

export function macFamilyFromBundleId(bundleId: string): Family | null {
  const b = bundleId.toLowerCase()
  if (b.includes('firefox')) return { engine: 'firefox', name: 'Firefox' }
  if (b.includes('librewolf')) return { engine: 'firefox', name: 'LibreWolf' }
  if (b.includes('zen')) return { engine: 'firefox', name: 'Zen' }
  if (b === 'com.google.chrome') return { engine: 'chromium', name: 'Google Chrome' }
  if (b === 'com.microsoft.edgemac') return { engine: 'chromium', name: 'Microsoft Edge' }
  if (b === 'com.brave.browser') return { engine: 'chromium', name: 'Brave' }
  if (b === 'com.vivaldi.vivaldi') return { engine: 'chromium', name: 'Vivaldi' }
  if (b.includes('opera')) return { engine: 'chromium', name: 'Opera' }
  return null
}

function macLocations(name: string): { firefoxRoot?: string; userDataDir?: string } {
  const support = join(homedir(), 'Library', 'Application Support')
  switch (name) {
    case 'Firefox':
      return { firefoxRoot: join(support, 'Firefox') }
    case 'LibreWolf':
      return { firefoxRoot: join(support, 'librewolf') }
    case 'Zen':
      return { firefoxRoot: join(support, 'zen') }
    case 'Google Chrome':
      return { userDataDir: join(support, 'Google', 'Chrome') }
    case 'Microsoft Edge':
      return { userDataDir: join(support, 'Microsoft Edge') }
    case 'Brave':
      return { userDataDir: join(support, 'BraveSoftware', 'Brave-Browser') }
    case 'Vivaldi':
      return { userDataDir: join(support, 'Vivaldi') }
    case 'Opera':
      return { userDataDir: join(support, 'com.operasoftware.Opera') }
    default:
      return {}
  }
}

// Pulls the https handler bundle id out of LaunchServices plist converted to JSON.
export function parseMacDefaultBrowser(json: string): string | null {
  try {
    const data = JSON.parse(json) as { LSHandlers?: Array<{ LSHandlerURLScheme?: string; LSHandlerRoleAll?: string }> }
    const handler = data.LSHandlers?.find((h) => h.LSHandlerURLScheme === 'https')
    return handler?.LSHandlerRoleAll ?? null
  } catch {
    return null
  }
}

// ---- Linux ----

export function linuxFamilyFromDesktop(desktop: string): Family | null {
  const d = desktop.toLowerCase()
  if (d.includes('firefox')) return { engine: 'firefox', name: 'Firefox' }
  if (d.includes('librewolf')) return { engine: 'firefox', name: 'LibreWolf' }
  if (d.includes('zen')) return { engine: 'firefox', name: 'Zen' }
  if (d.includes('chromium')) return { engine: 'chromium', name: 'Chromium' }
  if (d.includes('chrome')) return { engine: 'chromium', name: 'Google Chrome' }
  if (d.includes('msedge') || d.includes('microsoft-edge')) return { engine: 'chromium', name: 'Microsoft Edge' }
  if (d.includes('brave')) return { engine: 'chromium', name: 'Brave' }
  if (d.includes('vivaldi')) return { engine: 'chromium', name: 'Vivaldi' }
  if (d.includes('opera')) return { engine: 'chromium', name: 'Opera' }
  return null
}

function linuxLocations(name: string): { firefoxRoot?: string; userDataDir?: string } {
  const config = join(homedir(), '.config')
  switch (name) {
    case 'Firefox':
      return { firefoxRoot: join(homedir(), '.mozilla', 'firefox') }
    case 'LibreWolf':
      return { firefoxRoot: join(homedir(), '.librewolf') }
    case 'Zen':
      return { firefoxRoot: join(homedir(), '.zen') }
    case 'Google Chrome':
      return { userDataDir: join(config, 'google-chrome') }
    case 'Chromium':
      return { userDataDir: join(config, 'chromium') }
    case 'Microsoft Edge':
      return { userDataDir: join(config, 'microsoft-edge') }
    case 'Brave':
      return { userDataDir: join(config, 'BraveSoftware', 'Brave-Browser') }
    case 'Vivaldi':
      return { userDataDir: join(config, 'vivaldi') }
    case 'Opera':
      return { userDataDir: join(config, 'opera') }
    default:
      return {}
  }
}

function unsupported(reason: string): BrowserTarget {
  return { engine: 'unsupported', name: '', profileDir: '', reason }
}

// The Chromium default profile: a profile named "Default" under User Data (Opera on Windows/Linux keeps its profile
// directly in the folder).
function chromiumProfileDir(userDataDir: string): string {
  const def = join(userDataDir, 'Default')
  if (existsSync(join(def, 'Network', 'Cookies')) || existsSync(join(def, 'Cookies'))) return def
  if (existsSync(join(userDataDir, 'Network', 'Cookies')) || existsSync(join(userDataDir, 'Cookies'))) return userDataDir
  return def
}

// Detects the OS default browser and where its default profile's cookies live. Best effort: returns an 'unsupported'
// target with a reason when the browser is unknown or its files are missing.
export async function detectDefaultBrowser(
  run: Run,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<BrowserTarget> {
  let family: Family | null = null
  let locations: { firefoxRoot?: string; userDataDir?: string } = {}
  if (platform === 'win32') {
    const out = await run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', '/v', 'ProgId'])
    const progId = parseRegProgId(out)
    if (!progId) return unsupported('Could not tell which browser is your default.')
    family = windowsFamilyFromProgId(progId)
    if (!family) return unsupported(`Importing from your default browser is not supported yet (${progId}).`)
    locations = windowsLocations(family.name, env)
  } else if (platform === 'darwin') {
    const plist = join(homedir(), 'Library', 'Preferences', 'com.apple.LaunchServices', 'com.apple.launchservices.secure.plist')
    const json = await run('plutil', ['-convert', 'json', '-o', '-', plist])
    const bundle = parseMacDefaultBrowser(json)
    if (!bundle) return unsupported('Could not tell which browser is your default.')
    family = macFamilyFromBundleId(bundle)
    if (!family) return unsupported(`Importing from your default browser is not supported yet (${bundle}).`)
    locations = macLocations(family.name)
  } else {
    const out = (await run('xdg-settings', ['get', 'default-web-browser'])).trim()
    if (!out) return unsupported('Could not tell which browser is your default.')
    family = linuxFamilyFromDesktop(out)
    if (!family) return unsupported(`Importing from your default browser is not supported yet (${out}).`)
    locations = linuxLocations(family.name)
  }

  if (family.engine === 'firefox') {
    if (!locations.firefoxRoot || !existsSync(locations.firefoxRoot)) return unsupported(`Could not find ${family.name}'s profile.`)
    const dir = firefoxProfileDir(locations.firefoxRoot)
    if (!dir) return unsupported(`Could not find ${family.name}'s cookies.`)
    return { engine: 'firefox', name: family.name, profileDir: dir }
  }
  // Chromium.
  if (!locations.userDataDir || !existsSync(locations.userDataDir)) return unsupported(`Could not find ${family.name}'s profile.`)
  const profileDir = chromiumProfileDir(locations.userDataDir)
  return { engine: 'chromium', name: family.name, profileDir, userDataDir: locations.userDataDir }
}

// A profile folder's own name, safe to show (Firefox names are like "abcd1234.default-release").
export function profileLabel(dir: string): string {
  return basename(dir)
}
