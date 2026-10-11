import { useMemoryDiagnostics, useOptionalMcp, useSettings } from '@/lib/queries'

// Learning and memory run through Hindsight and CodeGraph. Says which one is switched off or not installed.
export function MemoryToolsWarning() {
  const settings = useSettings()
  const diag = useMemoryDiagnostics()
  const optional = useOptionalMcp(null)
  const s = settings.data
  if (!s) return null
  const active = (s.learn.enabled && s.learn.mode !== 'off') || s.memory.recallMode !== 'off'
  if (!active) return null
  const problems: string[] = []
  if (!s.learn.hindsight) problems.push('Hindsight is switched off')
  else if (diag.data?.hindsight.state === 'no-uv') problems.push('Hindsight is not installed (it needs uv)')
  const cg = optional.data?.find((e) => e.id === 'codegraph')
  if (!s.learn.codegraph) problems.push('CodeGraph is switched off')
  else if (cg && !cg.runtime.ok) problems.push('CodeGraph is not installed')
  if (!problems.length) return null
  return (
    <p role="alert" className="border-destructive/40 text-destructive rounded-md border px-3 py-2 text-xs">
      Learning and memory are not used without Hindsight and CodeGraph: {problems.join('; ')}.
    </p>
  )
}
