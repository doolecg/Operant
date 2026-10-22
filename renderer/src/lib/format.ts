export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(at).toLocaleDateString()
}

export const compact = (n: number) => n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })

// "4m", "2h", "3d": how long ago, as short as it gets (a minute or less is "now").
export function shortAge(at: number, now = Date.now()): string {
  const m = Math.floor(Math.max(0, now - at) / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}
