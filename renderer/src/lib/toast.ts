import { useSyncExternalStore } from 'react'
import { notify } from './notices'

export interface Toast {
  id: number
  text: string
  error: boolean
  // Set while the exit animation plays.
  leaving?: boolean
}

let toasts: Toast[] = []
let next = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function dismissToast(id: number): void {
  if (!toasts.some((t) => t.id === id && !t.leaving)) return
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t))
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 240)
}

// A short message in the corner; it clears itself (errors stay longer).
export function toast(text: string, error = false): void {
  notify(text, error ? 'error' : 'info')
  const id = next++
  toasts = [...toasts.slice(-3), { id, text, error }]
  emit()
  setTimeout(() => dismissToast(id), error ? 9000 : 4000)
}

export const useToasts = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => toasts,
  )
