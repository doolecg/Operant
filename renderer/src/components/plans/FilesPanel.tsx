import type { GitFileEntry } from '@shared/git'
import { OPEN_CHANGES_EVENT, type OpenChangesDetail } from '@/components/chat/ChangedFilesCard'
import { baseName, dirName, letterOf } from '@/components/git/status'
import { useRepoStatus } from '@/lib/queries'
import { cn } from '@/lib/utils'

const openDiff = (path: string) => window.dispatchEvent(new CustomEvent<OpenChangesDetail>(OPEN_CHANGES_EVENT, { detail: { path } }))

const sideOf = (f: GitFileEntry) => (f.conflicted ? 'conflict' : f.untracked ? 'untracked' : f.y !== '.' ? 'unstaged' : 'staged')

// The open project's changed files, one row each with its git status letter; a row opens that file's diff on the Git page. Body only, the caller frames it.
export function FilesPanel({ crewId }: { crewId: number | null }) {
  const status = useRepoStatus(crewId).data
  const files = status?.files ?? []
  return (
    <section aria-label="Files" className="flex min-h-0 w-full flex-col overflow-y-auto px-7 pt-5 pb-6">
      <div className="flex h-[30px] items-center gap-2">
        <h2 className="text-base font-semibold">Files</h2>
        {files.length > 0 && <span className="text-muted-foreground ml-auto text-[12.5px]">{files.length + (status?.more ?? 0)} changed</span>}
      </div>
      {!status ? (
        <p className="text-muted-foreground mt-5 text-[13px]">This project has no git changes to show.</p>
      ) : files.length === 0 ? (
        <p className="text-muted-foreground mt-5 text-[13px]">Clean, nothing changed.</p>
      ) : (
        <ul aria-label="Changed files" className="-mx-2 mt-3 flex flex-col">
          {files.map((f) => {
            const l = letterOf(f, sideOf(f))
            const dir = dirName(f.path)
            return (
              <li key={f.path}>
                <button
                  type="button"
                  aria-label={`Open the diff of ${f.path} (${l.name})`}
                  title={f.path}
                  onClick={() => openDiff(f.path)}
                  className="m-press hover:bg-accent focus-visible:ring-ring flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2"
                >
                  <span aria-hidden className={cn('w-4 shrink-0 text-center font-mono text-xs font-semibold', l.color)}>
                    {l.letter}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {baseName(f.path)}
                    {dir && <span className="text-muted-foreground ml-2 text-xs">{dir}</span>}
                  </span>
                </button>
              </li>
            )
          })}
          {status.more > 0 &&<li className="text-muted-foreground px-2 py-1.5 text-xs">+{status.more} more</li>}
        </ul>
      )}
    </section>
  )
}
