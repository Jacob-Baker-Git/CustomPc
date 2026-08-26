import useBuilderStore from '../store/useBuilderStore'
import { USE_CASES } from '../lib/buildProfiles'

// What the machine is for. It sits ABOVE the CustomPC score rather than inside
// it because it drives more than the score — Auto-build and the recommendation
// both read it — and because a control that changes every number under it should
// not look like part of the readout it changes.
export default function UseCaseChips() {
  const useCase    = useBuilderStore((s) => s.useCase)
  const setUseCase = useBuilderStore((s) => s.setUseCase)

  return (
    // On its own surface: this label sits outside every panel on the Build tab
    // and was the one glyph run there over bare board.
    <div className="rounded-lg bg-surface p-3">
      <span className="block text-[11px] uppercase tracking-wide text-faint mb-2">Building this PC for</span>
      <div role="radiogroup" aria-label="Rate this build for" className="flex flex-wrap gap-1.5">
        {USE_CASES.map((u) => {
          const on = u.id === useCase
          return (
            <button
              key={u.id}
              role="radio"
              aria-checked={on}
              title={u.blurb}
              onClick={() => setUseCase(u.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors active:scale-95
                ${on
                  ? 'chip-pick border-gold bg-gold text-accent-ink'
                  : 'border-line bg-surface text-muted hover:text-ink hover:border-line-strong'}`}
            >
              {u.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
