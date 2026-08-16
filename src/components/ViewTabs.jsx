import { Cpu, Keyboard, Gauge, ClipboardList } from 'lucide-react'
import { VIEWS, BETA_VIEWS } from '../hooks/useHashView'

const ICONS = { build: Cpu, peripherals: Keyboard, performance: Gauge, summary: ClipboardList }

// The beta marker rides on the ICON in the bottom bar, not beside the label.
// Four tabs have to fit 320px, where each is 80px and "performance" already
// fills ~62px of it at 10px — a second word on that row wraps the longest label
// mid-word. Sitting above the icon, it costs no horizontal space at all.
//
// `title` rather than visible text on mobile would hide it from touch users
// entirely, so it stays visible; the screen-reader wording comes from the
// sr-only span, because "beta" read out mid-label is noise.
function BetaDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-3 px-1 rounded bg-surface-2 text-tech
                 text-[8px] font-bold uppercase tracking-wide leading-[1.4]"
    >
      beta
    </span>
  )
}

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
                ${on ? 'text-gold' : 'text-muted hover:text-ink'}`}
            >
              <span className="relative">
                <Icon size={18} aria-hidden="true" />
                {BETA_VIEWS.has(v) && <BetaDot />}
              </span>
              {v}
              {BETA_VIEWS.has(v) && <span className="sr-only"> (beta)</span>}
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
              ${on ? 'bg-gold text-accent-ink' : 'text-muted hover:text-ink hover:bg-surface-2'}`}
          >
            <Icon size={14} aria-hidden="true" />
            {v}
            {/* The active tab is already a solid gold fill, so the badge needs
                no plate of its own — accent-ink on that fill reads as a badge by
                itself. The inactive one sits on the dark well and does need a
                plate to separate from it. */}
            {BETA_VIEWS.has(v) && (
              <>
                <span
                  aria-hidden="true"
                  className={`px-1 rounded text-[9px] font-bold uppercase tracking-wide
                    ${on ? 'text-accent-ink' : 'bg-surface-2 text-tech'}`}
                >
                  beta
                </span>
                <span className="sr-only"> (beta)</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
