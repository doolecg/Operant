import { useMemo, useState } from 'react'
import { Globe, File, FileText, Image as ImageIcon, MoreHorizontal } from 'lucide-react'
import type { ChatImage, ChatItem } from '@shared/claude-chat'
import { decodeIpcError } from '@shared/ipc'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ImageModal } from '@/components/chat/ImageModal'
import { call } from '@/lib/queries'
import { ACTION_LABEL, artifactsOf, capArtifacts, type Artifact, type ArtifactAction, type ArtifactKind } from './artifacts'

const ICON: Record<ArtifactKind, typeof File> = { image: ImageIcon, html: Globe, markdown: FileText, pdf: FileText, document: FileText, file: File, url: Globe }
const KIND_LABEL: Record<ArtifactKind, string> = { image: 'Image', html: 'Page', markdown: 'Document', pdf: 'PDF', document: 'Document', file: 'File', url: 'Link' }

function ArtifactRow({ artifact, crewId, onImage }: { artifact: Artifact; crewId: number | null; onImage: (image: ChatImage) => void }) {
  const [error, setError] = useState<string | null>(null)
  const run = (action: ArtifactAction) => {
    setError(null)
    const fail = (e: unknown) => setError(decodeIpcError(e).message)
    if (action === 'external') {
      call('app:openExternal', artifact.target).catch(fail)
      return
    }
    if (crewId === null) return setError('Open a project first')
    if (action === 'image') call('docs:readImage', crewId, artifact.target).then(onImage).catch(fail)
    else if (action === 'browser') (artifact.kind === 'url' ? call('browser:open', crewId, artifact.target).then(() => undefined) : call('docs:open', crewId, artifact.target)).catch(fail)
    else call('shell:openPath', crewId, artifact.target).catch(fail)
  }
  const Icon = ICON[artifact.kind]
  const primary = artifact.actions[0]!
  return (
    <li className="min-w-0 text-xs" title={artifact.target}>
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
        <button
          type="button"
          aria-label={`${ACTION_LABEL[primary]}: ${artifact.name}`}
          onClick={() => run(primary)}
          className="hover:text-primary focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center rounded-sm text-left underline-offset-2 outline-none hover:underline focus-visible:ring-2"
        >
          <span className="min-w-0 truncate font-mono text-[11px]">{artifact.name}</span>
        </button>
        <span className="text-muted-foreground shrink-0 text-[10px]">{KIND_LABEL[artifact.kind]}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Actions for ${artifact.name}`} className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring grid size-5 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2">
              <MoreHorizontal aria-hidden className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {artifact.actions.map((a) => (
              <DropdownMenuItem key={a} onSelect={() => run(a)}>
                {ACTION_LABEL[a]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && (
        <div role="alert" className="text-destructive mt-0.5 pl-5 text-[11px]">
          {error}
        </div>
      )}
    </li>
  )
}

// What Claude made in this session (files it created or saved, pages and links it produced), newest first. A click does the
// natural thing for the type; the menu has every action. Shows nothing until there is something.
export function ArtifactsList({ items, crewId }: { items: ChatItem[]; crewId: number | null }) {
  const [showAll, setShowAll] = useState(false)
  const [image, setImage] = useState<{ image: ChatImage; at: number } | null>(null)
  const all = useMemo(() => artifactsOf(items), [items])
  const { shown, more } = capArtifacts(all, showAll)
  if (all.length === 0) return null
  return (
    <>
      <div className="border-border mt-2.5 border-t pt-2.5">
        <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase">Artifacts</div>
        <ul className="flex flex-col gap-1.5" aria-label="Artifacts this session made">
          {shown.map((a) => (
            <ArtifactRow key={a.key} artifact={a} crewId={crewId} onImage={(im) => setImage({ image: im, at: Date.now() })} />
          ))}
        </ul>
        {all.length > 5 && (
          <button type="button" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)} className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-1.5 rounded-sm text-[11px] outline-none hover:underline focus-visible:ring-2">
            {showAll ? 'Show fewer' : `Show all ${all.length} (+${more} more)`}
          </button>
        )}
      </div>
      <ImageModal image={image?.image ?? null} at={image?.at ?? 0} index={0} onClose={() => setImage(null)} />
    </>
  )
}
