import { Cpu, Keyboard, ClipboardList } from 'lucide-react'
import { VIEWS } from '../hooks/useHashView'

const ICONS = { build: Cpu, peripherals: Keyboard, summary: ClipboardList }

// The builder's view switcher, in two shapes. `inline` sits in the top bar on
// wide screens; `bar` is the bottom bar everywhere else, which keeps the header
// to the single row it has to stay on.
//
// The split is at `lg`, not `md`: at 768px the header already carries the back
// arrow, wordmark, and the budget/remaining/power readout, and adding tabs
// there wraps it to two rows.
export default function ViewTabs({ view, onChange, variant = 'inline' }) {
  if (variant === 'bar') {
    return (
      <nav
        aria-label="Views"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line flex pb-[env(safe-area-inset-bottom)]"
      >
        {VIEWS.map((v) => {
          const Icon = ICONS[v]
          const on = view === v
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              aria-current={on ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold capitalize transition-colors
                ${on ? 'text-accent' : 'text-muted hover:text-ink'}`}
            >
              <Icon size={18} aria-hidden="true" />
              {v}
            </button>
          )
        })}
      </nav>
    )
  }

  // An inset well (bg-ground is darker than the header's bg-surface) reads as a
  // control rather than a floating box, and equal-width segments stop the group
  // from jittering as the active label changes.
  return (
    <div className="hidden lg:inline-flex rounded-xl bg-ground border border-line p-1 gap-1">
      {VIEWS.map((v) => {
        const Icon = ICONS[v]
        const on = view === v
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-current={on ? 'page' : undefined}
            className={`flex items-center justify-center gap-1.5 min-w-[104px] xl:min-w-[118px] px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors
              ${on ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink hover:bg-surface-2'}`}
          >
            <Icon size={14} aria-hidden="true" />
            {v}
          </button>
        )
      })}
    </div>
  )
}
