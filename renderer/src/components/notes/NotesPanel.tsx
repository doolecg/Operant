import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { Bold, Italic, List, ListChecks, PanelLeftClose, PanelLeftOpen, Plus, StickyNote, Trash2 } from 'lucide-react'
import { decodeIpcError } from '@shared/ipc'
import { NOTE_COLORS, noteHtmlToSave, noteTextToHtml, type Note, type NoteColor } from '@shared/notes'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResizeHandle } from '@/components/ui/resize-handle'
import { usePanelWidth } from '@/lib/layout'
import { call, useNotes } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export const NOTES_DEFAULT = 260
export const NOTES_MIN = 200
export const NOTES_MAX = 400
export const NOTES_RAIL = 44

const failed = (e: unknown) => toast(decodeIpcError(e).message, true)

// Colour name -> the theme token it uses (card edge, tint and swatch).
const TONE: Record<NoteColor, { edge: string; tint: string; swatch: string }> = {
  yellow: { edge: 'border-l-chart-2', tint: 'bg-chart-2/10', swatch: 'bg-chart-2' },
  blue: { edge: 'border-l-chart-1', tint: 'bg-chart-1/10', swatch: 'bg-chart-1' },
  green: { edge: 'border-l-chart-3', tint: 'bg-chart-3/10', swatch: 'bg-chart-3' },
  purple: { edge: 'border-l-chart-4', tint: 'bg-chart-4/10', swatch: 'bg-chart-4' },
  orange: { edge: 'border-l-chart-6', tint: 'bg-chart-6/10', swatch: 'bg-chart-6' },
}

const BOX = (checked: boolean) => `<span data-checked="${checked}" contenteditable="false" role="checkbox" aria-checked="${checked}" aria-label="Done"></span>`
// The checkbox spans in stored html get the attributes the editor needs.
const toEditor = (html: string) => html.replace(/<span data-checked="(true|false)"><\/span>/g, (_m, c: string) => BOX(c === 'true'))

const boxOf = (li: Element) => li.querySelector(':scope > span[data-checked]')
const lineItem = (n: Node | null, root: HTMLElement) => {
  const el = n instanceof Element ? n : n?.parentElement
  const li = el?.closest('li')
  return li && root.contains(li) ? li : null
}

const CHECK_STYLE = [
  '[&_li:has(>span[data-checked])]:list-none [&_li:has(>span[data-checked])]:-ml-5',
  '[&_span[data-checked]]:border-foreground/50 [&_span[data-checked]]:mr-1.5 [&_span[data-checked]]:inline-block [&_span[data-checked]]:size-3.5 [&_span[data-checked]]:translate-y-0.5 [&_span[data-checked]]:cursor-pointer [&_span[data-checked]]:rounded-[3px] [&_span[data-checked]]:border',
  "[&_span[data-checked=true]]:bg-primary [&_span[data-checked=true]]:border-primary [&_span[data-checked=true]]:after:text-primary-foreground [&_span[data-checked=true]]:after:block [&_span[data-checked=true]]:after:text-center [&_span[data-checked=true]]:after:text-[10px] [&_span[data-checked=true]]:after:leading-[13px] [&_span[data-checked=true]]:after:content-['✓']",
]

function NoteCard({ note, autoFocus, onDelete }: { note: Note; autoFocus: boolean; onDelete: (n: Note) => void }) {
  const saved = useRef(note.text)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const id = note.id
  const editor = useRef<HTMLDivElement>(null)
  const [empty, setEmpty] = useState(note.text.trim() === '')
  const [active, setActive] = useState({ bold: false, italic: false })

  const flush = () => {
    clearTimeout(timer.current)
    if (!editor.current) return
    const next = noteHtmlToSave(editor.current.innerHTML)
    if (next === saved.current) return
    saved.current = next
    void call('notes:update', id, { text: next }).catch(failed)
  }
  const changed = () => {
    const el = editor.current
    if (!el) return
    setEmpty(noteHtmlToSave(el.innerHTML) === '')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 400)
  }
  const inEditor = () => {
    const sel = window.getSelection()
    return sel && sel.rangeCount > 0 && editor.current?.contains(sel.anchorNode) ? sel : null
  }
  const refreshActive = () => {
    if (!inEditor()) return
    setActive({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic') })
  }
  const exec = (cmd: 'bold' | 'italic' | 'insertUnorderedList') => {
    editor.current?.focus()
    document.execCommand(cmd)
    changed()
    refreshActive()
  }
  // The list items the selection touches.
  const selectedItems = () => {
    const sel = inEditor()
    const el = editor.current
    if (!sel || !el) return []
    const r = sel.getRangeAt(0)
    return Array.from(el.querySelectorAll('li')).filter((li) => r.intersectsNode(li))
  }
  const bullet = () => {
    const boxed = selectedItems().filter((li) => boxOf(li))
    if (boxed.length > 0) {
      // A checklist becomes a plain bullet list.
      boxed.forEach((li) => boxOf(li)?.remove())
      changed()
      return
    }
    exec('insertUnorderedList')
  }
  const checklist = () => {
    editor.current?.focus()
    if (selectedItems().length === 0) document.execCommand('insertUnorderedList')
    const items = selectedItems()
    if (items.length > 0 && items.every((li) => boxOf(li))) {
      items.forEach((li) => boxOf(li)?.remove())
    } else {
      items.forEach((li) => {
        if (boxOf(li)) return
        li.insertAdjacentHTML('afterbegin', BOX(false))
        if (li.lastChild === boxOf(li)) li.append(document.createElement('br'))
      })
    }
    changed()
  }
  const toggleBox = (box: Element) => {
    const on = box.getAttribute('data-checked') !== 'true'
    box.setAttribute('data-checked', String(on))
    box.setAttribute('aria-checked', String(on))
    changed()
    flush()
  }
  const enterInChecklist = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = editor.current
    const sel = inEditor()
    const li = sel && el ? lineItem(sel.anchorNode, el) : null
    if (!sel || !li || !boxOf(li) || !sel.isCollapsed) return
    e.preventDefault()
    const r = document.createRange()
    if ((li.textContent ?? '').trim() === '') {
      // Enter on an empty item ends the list.
      const list = li.parentElement
      const line = document.createElement('div')
      line.append(document.createElement('br'))
      li.remove()
      if (list && list.children.length === 0) list.replaceWith(line)
      else list?.after(line)
      r.setStart(line, 0)
    } else {
      const next = document.createElement('li')
      next.innerHTML = BOX(false)
      next.append(document.createElement('br'))
      li.after(next)
      r.setStartAfter(next.firstChild!)
    }
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
    changed()
  }
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault()
      exec(e.key === 'b' ? 'bold' : 'italic')
    } else if (e.key === 'Enter' && !e.shiftKey) enterInChecklist(e)
  }
  const paste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }
  const click = (e: MouseEvent<HTMLDivElement>) => {
    const box = (e.target as HTMLElement).closest('span[data-checked]')
    if (box && e.currentTarget.contains(box)) toggleBox(box)
  }

  // The editor is uncontrolled: it is filled once from the stored text.
  useLayoutEffect(() => {
    if (editor.current) editor.current.innerHTML = toEditor(noteTextToHtml(note.text))
  }, [])
  useEffect(() => {
    if (autoFocus) editor.current?.focus()
  }, [autoFocus])
  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive)
    return () => document.removeEventListener('selectionchange', refreshActive)
  }, [])
  // A pending edit is saved when the card goes away (the project changes, the panel closes).
  useEffect(() => flush, [])

  const tone = TONE[note.color]
  const formats = [
    { label: 'Bold', Icon: Bold, run: () => exec('bold'), pressed: active.bold },
    { label: 'Italic', Icon: Italic, run: () => exec('italic'), pressed: active.italic },
    { label: 'Bullet list', Icon: List, run: bullet, pressed: undefined },
    { label: 'Checklist', Icon: ListChecks, run: checklist, pressed: undefined },
  ]
  return (
    <li data-testid="note-card" className={cn('flex flex-col gap-1 rounded-xl border border-l-4 px-3 py-2', tone.edge, tone.tint)}>
      <div
        ref={editor}
        role="textbox"
        aria-multiline="true"
        aria-label="Note text"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-placeholder="Write a note"
        data-empty={empty}
        onInput={changed}
        onBlur={flush}
        onKeyDown={keyDown}
        onPaste={paste}
        onClick={click}
        className={cn(
          'relative max-h-64 min-h-14 overflow-y-auto text-sm break-words outline-none',
          'data-[empty=true]:before:text-muted-foreground data-[empty=true]:before:pointer-events-none data-[empty=true]:before:absolute data-[empty=true]:before:content-[attr(data-placeholder)]',
          '[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_b]:font-semibold [&_i]:italic',
          ...CHECK_STYLE,
        )}
      />
      <div className="flex items-center gap-1">
        <div role="group" aria-label="Note colour" className="mr-auto flex items-center gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={note.color === c}
              title={c}
              onClick={() => void call('notes:update', id, { color: c }).catch(failed)}
              className={cn(
                'focus-visible:ring-ring/50 size-4 rounded-full outline-none focus-visible:ring-[3px]',
                TONE[c].swatch,
                note.color === c ? 'ring-foreground ring-2 ring-offset-1 ring-offset-transparent' : 'opacity-70 hover:opacity-100',
              )}
            />
          ))}
        </div>
        <div role="group" aria-label="Note formatting" className="flex items-center">
          {formats.map(({ label, Icon, run, pressed }) => (
            <Button key={label} variant="ghost" size="icon-sm" aria-label={label} aria-pressed={pressed} title={label} onMouseDown={(e) => e.preventDefault()} onClick={run}>
              <Icon />
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Delete note" title="Delete note" onClick={() => onDelete(note)}>
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}

// A project's sticky notes beside its terminal tiles. `onCollapse` is set when it floats over the tiles from the narrow rail.
export function NotesPanel({ crewId, onCollapse }: { crewId: number | null; onCollapse?: () => void }) {
  const notes = useNotes(crewId).data ?? []
  const panel = usePanelWidth('notesWidth')
  const aside = useRef<HTMLElement>(null)
  const [focusId, setFocusId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)

  const add = () => {
    if (crewId == null) return
    void call('notes:create', crewId, 'yellow')
      .then((n) => setFocusId(n.id))
      .catch(failed)
  }
  const confirmDelete = () => {
    const n = deleting
    setDeleting(null)
    if (n) void call('notes:delete', n.id).catch(failed)
  }

  return (
    <aside
      ref={aside}
      aria-label="Notes"
      style={{ width: panel.width || NOTES_DEFAULT, minWidth: NOTES_MIN, maxWidth: NOTES_MAX }}
      className={cn('bg-card relative m-1.5 mr-0 flex shrink-0 flex-col rounded-2xl border shadow-xs dark:shadow-none', onCollapse && 'absolute inset-y-0 left-0 z-40 shadow-lg')}
    >
      <ResizeHandle
        target={aside}
        axis="x"
        grow={1}
        min={NOTES_MIN}
        max={NOTES_MAX}
        label="Resize notes"
        className="-right-[3px] w-1.5 cursor-ew-resize"
        {...panel.handle}
      />
      <div className="flex h-8 shrink-0 items-center gap-1 pr-1.5 pl-3.5">
        <span className="text-primary text-[10.5px] font-semibold tracking-[.09em] uppercase">Notes</span>
        <span className="text-muted-foreground mr-auto text-xs tabular-nums" aria-label={`${notes.length} notes`}>
          {notes.length}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Add note" title="Add note" disabled={crewId == null} onClick={add}>
          <Plus />
        </Button>
        {onCollapse && (
          <Button variant="ghost" size="icon-sm" aria-label="Collapse Notes panel" title="Collapse Notes panel" onClick={onCollapse}>
            <PanelLeftClose />
          </Button>
        )}
      </div>
      {notes.length === 0 ? (
        <div className="grid flex-1 place-content-center justify-items-center gap-3 p-4 text-center">
          <p className="text-muted-foreground text-sm">No notes for this project yet. Add one to keep reminders beside your terminals.</p>
          <Button size="sm" variant="outline" disabled={crewId == null} onClick={add}>
            Add note
          </Button>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} autoFocus={n.id === focusId} onDelete={setDeleting} />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting != null}
        title="Delete note?"
        description={
          deleting
            ? `This deletes one note of ${deleting.text.length} character${deleting.text.length === 1 ? '' : 's'} (${notes.length} in this project). This cannot be undone.`
            : ''
        }
        confirmLabel="Delete note"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </aside>
  )
}

// The narrow terminal area's stand-in for the panel.
export function NotesRail({ onExpand }: { onExpand: () => void }) {
  return (
    <aside aria-label="Notes" style={{ width: NOTES_RAIL }} className="bg-card m-1.5 mr-0 flex shrink-0 flex-col items-center rounded-2xl border py-1.5 shadow-xs dark:shadow-none">
      <Button variant="ghost" size="icon-sm" aria-label="Expand Notes panel" title="Expand Notes panel" onClick={onExpand}>
        <PanelLeftOpen />
      </Button>
      <StickyNote aria-hidden className="text-muted-foreground mt-2 size-4" />
    </aside>
  )
}
