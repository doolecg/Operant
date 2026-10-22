import { useState } from 'react'
import { Check, FileText } from 'lucide-react'
import { decodeIpcError } from '@shared/ipc'
import type { PlanGate, PlanSlice } from '@shared/engineering'
import { call } from '@/lib/queries'
import { useTaskPlan } from '@/lib/queries/engineering'
import { cn } from '@/lib/utils'

const SectionHead = ({ children }: { children: string }) => <h3 className="text-muted-foreground mt-7 mb-3 text-[12.5px] font-semibold">{children}</h3>

function Gate({ gate }: { gate: Exclude<PlanGate, 'none'> }) {
  const approved = gate === 'approved'
  return (
    <div role="status" className="mt-5 flex items-center gap-3">
      {approved ? (
        <span aria-hidden className="bg-success text-background grid size-5 shrink-0 place-items-center rounded-full">
          <Check className="size-3" strokeWidth={2.8} />
        </span>
      ) : (
        <span aria-hidden className="border-primary grid size-5 shrink-0 place-items-center rounded-full border-2">
          <i className="bg-primary size-1.5 rounded-full" />
        </span>
      )}
      <b className="text-[13.5px] font-semibold">{approved ? 'Plan approved' : 'Waiting for your OK on the plan'}</b>
    </div>
  )
}

function SliceRow({ slice }: { slice: PlanSlice }) {
  return (
    <li aria-current={slice.current ? 'step' : undefined} className="flex items-start gap-3">
      {slice.done ? (
        <span aria-hidden className="bg-accent text-foreground grid size-5 shrink-0 place-items-center rounded-full">
          <Check className="size-[11px]" strokeWidth={2.8} />
        </span>
      ) : slice.current ? (
        <span aria-hidden className="border-primary grid size-5 shrink-0 place-items-center rounded-full border-2">
          <i className="bg-primary size-1.5 rounded-full" />
        </span>
      ) : (
        <span aria-hidden className="border-muted-foreground/50 size-5 shrink-0 rounded-full border-[1.6px] border-dashed" />
      )}
      <div className="min-w-0">
        <div className={cn('text-[13.5px] leading-5', slice.current ? 'text-foreground font-semibold' : slice.done ? 'text-muted-foreground font-medium' : 'text-muted-foreground')}>{slice.label}</div>
        <div className="text-muted-foreground text-[12.5px] leading-[18px]">{slice.done ? 'Done' : slice.current ? 'Next up' : 'Pending'}</div>
      </div>
    </li>
  )
}

// The open project's newest Engineering task: the plan gate, its slices and the spec page. Body only, the caller frames it.
export function PlanPanel({ crewId }: { crewId: number | null }) {
  const plan = useTaskPlan(crewId).data
  const [error, setError] = useState<string | null>(null)
  const done = plan?.slices.filter((s) => s.done).length ?? 0
  const openSpec = () => {
    if (crewId === null || !plan?.specPath) return
    setError(null)
    call('docs:open', crewId, plan.specPath).catch((e: unknown) => setError(decodeIpcError(e).message))
  }
  return (
    <section aria-label="Plan" className="flex min-h-0 w-full flex-col overflow-y-auto px-7 pt-5 pb-6">
      <div className="flex h-[30px] items-center gap-2">
        <h2 className="text-base font-semibold">Plan</h2>
        {plan && plan.slices.length > 0 && (
          <span className="text-muted-foreground ml-auto text-[12.5px]">
            {done} of {plan.slices.length} slices done
          </span>
        )}
      </div>
      {!plan ? (
        <p className="text-muted-foreground mt-5 text-[13px]">No Engineering task in this project yet.</p>
      ) : (
        <>
          <p className="text-foreground mt-3 text-[13.5px] leading-5 font-medium">{plan.title}</p>
          {plan.gate !== 'none' && <Gate gate={plan.gate} />}
          {plan.slices.length > 0 && (
            <>
              <SectionHead>Slices</SectionHead>
              <ol aria-label="Slices" className="flex flex-col gap-3.5">
                {plan.slices.map((s, i) => (
                  <SliceRow key={i} slice={s} />
                ))}
              </ol>
            </>
          )}
          {plan.specPath && (
            <>
              <SectionHead>Spec</SectionHead>
              <button
                type="button"
                aria-label={`Open the spec ${plan.specTitle ?? ''} in the browser`.replace(/\s+/g, ' ')}
                onClick={openSpec}
                className="m-press hover:bg-accent focus-visible:ring-ring -mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] leading-5 outline-none focus-visible:ring-2"
              >
                <FileText aria-hidden className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{plan.specTitle ?? 'spec.html'}</span>
                <span className="text-muted-foreground shrink-0 text-xs">Open</span>
              </button>
              {error && (
                <div role="alert" className="text-destructive mt-1 text-[11px]">
                  {error}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
