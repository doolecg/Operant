import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { Copy, Download, Maximize, Minus, Plus } from 'lucide-react'
import type { ChatImage } from '@shared/claude-chat'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { imageFileName } from './chatHelpers'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 16
const STEP = 1.25
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

// The clipboard takes PNG reliably; other types are redrawn to PNG first.
async function pngBlob(dataUrl: string): Promise<Blob> {
  const blob = await (await fetch(dataUrl)).blob()
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not convert the image'))), 'image/png'))
}

async function copyImage(dataUrl: string): Promise<void> {
  try {
    const blob = await pngBlob(dataUrl)
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    toast('Image copied')
  } catch {
    toast('Could not copy the image', true)
  }
}

function saveImage(image: ChatImage, at: number, index: number): void {
  const a = document.createElement('a')
  a.href = image.dataUrl
  a.download = imageFileName(image.mediaType, new Date(at), index)
  a.click()
}

interface Props {
  image: ChatImage | null
  // When the message was sent and the image's place in it (for the saved file's name).
  at: number
  index: number
  onClose: () => void
}

// A sent image at full size: zoom (buttons, wheel), drag to pan when zoomed, copy and save.
export function ImageModal({ image, at, index, onClose }: Props) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  // null: fit to the window.
  const [zoom, setZoom] = useState<number | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    setNatural(null)
    setZoom(null)
    setPan({ x: 0, y: 0 })
  }, [image?.dataUrl])

  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const ro = new ResizeObserver(() => setView({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setView({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const fitScale = natural && view.w > 0 && view.h > 0 ? Math.min(1, view.w / natural.w, view.h / natural.h) : 1
  const scale = zoom ?? fitScale
  const pannable = natural ? natural.w * scale > view.w || natural.h * scale > view.h : false

  const zoomTo = (z: number | null) => {
    setZoom(z === null ? null : clampZoom(z))
    if (z === null) setPan({ x: 0, y: 0 })
  }
  const onWheel = (e: ReactWheelEvent) => {
    if (!natural || e.deltaY === 0) return
    zoomTo(e.deltaY < 0 ? scale * 1.1 : scale / 1.1)
  }
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!pannable || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    setDragging(true)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  return (
    <Dialog open={image !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" className="h-[min(92vh,calc(100%-2rem))]" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Image</DialogTitle>
        <div className="flex shrink-0 items-center gap-1 border-b py-2 pr-12 pl-3" role="toolbar" aria-label="Image tools">
          <Button variant="ghost" size="icon-sm" aria-label="Zoom out" title="Zoom out" onClick={() => zoomTo(scale / STEP)} disabled={!natural}>
            <Minus />
          </Button>
          <span className="text-muted-foreground w-12 text-center text-xs tabular-nums" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom in" title="Zoom in" onClick={() => zoomTo(scale * STEP)} disabled={!natural}>
            <Plus />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Actual size" title="Actual size (100%)" onClick={() => zoomTo(1)} disabled={!natural}>
            100%
          </Button>
          <Button variant="ghost" size="sm" aria-label="Fit to window" title="Fit to window" onClick={() => zoomTo(null)} disabled={!natural}>
            <Maximize />
            Fit
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" aria-label="Copy image" title="Copy image" onClick={() => image && void copyImage(image.dataUrl)} disabled={!image}>
            <Copy />
            Copy
          </Button>
          <Button variant="ghost" size="sm" aria-label="Save image" title="Save image" onClick={() => image && saveImage(image, at, index)} disabled={!image}>
            <Download />
            Save
          </Button>
        </div>
        <div
          ref={measure}
          className="bg-muted/30 relative min-h-0 flex-1 touch-none overflow-hidden select-none"
          style={{ cursor: pannable ? (dragging ? 'grabbing' : 'grab') : 'default' }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => zoomTo(zoom === null ? 1 : null)}
        >
          {image && (
            <img
              src={image.dataUrl}
              alt="Sent image"
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="absolute top-1/2 left-1/2 max-w-none"
              style={{
                width: natural?.w,
                height: natural?.h,
                visibility: natural ? 'visible' : 'hidden',
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
