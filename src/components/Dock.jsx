import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import useBuilderStore, { selTotalSpent, selPeripheralsTotal } from '../store/useBuilderStore'
import { dockTotalLabel, dockAction } from '../lib/dock'
import { useBuildActions } from '../hooks/useBuildActions'
import { BTN_PRIMARY } from '../lib/uiTokens'

// The configurator dock (spec 2026-10-16): the running total and the one thing
// to do next, pinned to the bottom of a phone so neither needs scrolling for.
// `inline` is the desktop form: just the action, at the end of the page.
export default function Dock({ view, onChange, inline = false }) {
  const path = useBuilderStore((s) => s.path)
  const build = useBuilderStore(selTotalSpent)
  const desk = useBuilderStore(selPeripheralsTotal)
  const { save, share, canSave } = useBuildActions()
  const [note, setNote] = useState(null)
  const action = dockAction({ view, path })

  // One timer at a time, cleared on unmount: a second tap restarts it, and
  // leaving the screen mid-flash no longer sets state on an unmounted Dock.
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = (text) => {
    setNote(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setNote(null), 1800)
  }

  const actions = action ? (
    <button type="button" onClick={() => onChange(action.to)}
            className={`${BTN_PRIMARY} inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm`}>
      {action.label} <ArrowRight size={15} aria-hidden="true" />
    </button>
  ) : (
    <div className="flex gap-2">
      <button type="button" onClick={async () => flash((await share()) ? 'Link copied' : 'Copy failed')}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]">
        Share
      </button>
      <button type="button" disabled={!canSave} onClick={() => { save(); flash('Saved') }}
              className={`${BTN_PRIMARY} min-h-11 rounded-xl px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40`}>
        Save build
      </button>
    </div>
  )

  if (inline) {
    // Summary has its own Save and Share; doubling them here offered two of
    // each that behaved differently.
    if (!action) return null
    return <div className="hidden justify-end px-4 pb-8 sm:px-6 lg:flex lg:px-10">{actions}</div>
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-ground px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 lg:hidden">
      <div className="min-w-0 flex-1">
        <div className="truncate font-wide text-[15px] font-extrabold text-ink">{dockTotalLabel({ view, build, desk })}</div>
        <div role="status" className="text-[12px] text-muted">{note ?? '\u00a0'}</div>
      </div>
      {actions}
    </div>
  )
}
