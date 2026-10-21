import { decodeIpcError } from '@shared/ipc'
import type { Crew } from '@shared/types'
import { bridge } from '@/lib/bridge'
import { toast } from '@/lib/toast'

const fail = (what: string, e: unknown) => toast(`${what}: ${decodeIpcError(e).message}`, true)

// Indexes one project; the error text, or null when it worked.
async function indexOne(crew: Crew): Promise<string | null> {
  try {
    const s = await bridge().invoke('index:run', crew.id)
    return s?.error ?? null
  } catch (e) {
    return decodeIpcError(e).message
  }
}

// The project actions that run in main or the browser and need nothing from the page: each reports a failure as a toast.
export const projectActions = {
  openIde: (crew: Crew) => bridge().invoke('ide:open', crew.id).catch((e) => fail('Could not open the IDE', e)),
  openFolder: (crew: Crew) => bridge().invoke('shell:openFolder', crew.id).catch((e) => fail('Could not open the folder', e)),
  index: async (crew: Crew) => {
    toast(`Indexing ${crew.name}…`)
    const err = await indexOne(crew)
    if (err) toast(`Indexing ${crew.name} failed: ${err}`, true)
    else toast(`${crew.name} indexed.`)
  },
  // Every project in turn, then one message with the outcome.
  indexMany: async (crews: Crew[]) => {
    if (crews.length === 0) return
    toast(`Indexing ${crews.length} ${crews.length === 1 ? 'project' : 'projects'}…`)
    const failures: string[] = []
    for (const c of crews) {
      const err = await indexOne(c)
      if (err) failures.push(`${c.name}: ${err}`)
    }
    if (failures.length) toast(`Indexed ${crews.length - failures.length} of ${crews.length}. ${failures.join('; ')}`, true)
    else toast(`Indexed ${crews.length} ${crews.length === 1 ? 'project' : 'projects'}.`)
  },
  copyPath: (crew: Crew) =>
    navigator.clipboard.writeText(crew.folder).then(
      () => toast('Path copied'),
      () => toast('Could not copy the path', true),
    ),
}

export const folderLabel = (platform: string) => (platform === 'win32' ? 'Open in Explorer' : platform === 'darwin' ? 'Reveal in Finder' : 'Open folder')
