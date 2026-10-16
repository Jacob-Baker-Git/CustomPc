import { VIEWS } from '../hooks/useHashView'

const LABEL = { build: 'Build', performance: 'Performance', peripherals: 'Peripherals', summary: 'Summary' }

// The builder's steps, numbered, across the top at every width (spec
// 2026-10-16). It replaces both the desktop tab row and the phone bottom bar.
// Every step stays reachable whatever path the build came from; the order is
// the parts path, which is the one people walk end to end.
export default function StepHeader({ view, onChange }) {
  const current = VIEWS.indexOf(view)
  return (
    <nav aria-label="Steps" className="border-b border-line bg-ground">
      <div className="flex gap-5 overflow-x-auto px-4 sm:px-6 lg:px-10 [scrollbar-width:none]">
        {VIEWS.map((v, i) => {
          const on = v === view
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-current={on ? 'page' : undefined}
              className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 py-2.5 text-[13px] transition-colors
                ${on ? 'border-brass font-bold text-ink' : `border-transparent hover:text-ink ${i < current ? 'text-muted' : 'text-faint'}`}`}
            >
              <span aria-hidden="true" className="mr-1.5 font-mono text-[11px]">{String(i + 1).padStart(2, '0')}</span>
              {LABEL[v]}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
