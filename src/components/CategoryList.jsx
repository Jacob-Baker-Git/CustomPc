import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../lib/categoryIcons'
import { RECOMMENDED_ORDER, nextRecommended, isOptional } from '../lib/recommendedOrder'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

const OPTIONAL_NOTE = 'Optional — most coolers ship with paste applied'

// Hovering a row used to highlight the matching part in the 3D view. That
// highlight was removed, and these handlers went with it rather than being left
// writing to a store field nobody reads — see PartModel.
//
// `emphasiseMissing` is the Build tab's louder treatment: unfilled essentials go
// red and tagged. SetupFlow renders the same list for "the PC I already own",
// where an empty slot means "I don't have one" — so it stays off by default.
export default function CategoryList({
  selectedParts,
  onSelectCategory,
  onDeselect,
  columns = 1,
  emphasiseMissing = false,
}) {
  const next = nextRecommended(selectedParts)
  const wrap = columns === 2 ? 'grid grid-cols-1 lg:grid-cols-2 gap-2' : 'space-y-2'

  return (
    <div className={wrap}>
      {ORDERED.map((cat, i) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next
        const optional = isOptional(cat.id)

        if (part) {
          return (
            <div key={cat.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <button onClick={() => onSelectCategory(cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <CategoryIcon id={cat.id} className="text-muted" />
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide text-faint leading-none">{cat.label}</span>
                  <span className="block text-sm text-ink truncate leading-tight mt-0.5">{part.name}</span>
                </span>
              </button>
              <span className="font-mono tabular-nums text-sm text-accent shrink-0">£{part.price.toFixed(0)}</span>
              <button onClick={() => onDeselect(cat.id)} aria-label={`Remove ${cat.label}`} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-bad text-sm shrink-0 transition-colors">&times;</button>
            </div>
          )
        }

        // Three empty shapes: a real hole (red), the one to do next (red + accent
        // pill), and a deliberately empty optional slot (neutral, explained).
        const flagged = emphasiseMissing && !optional
        const explained = emphasiseMissing && optional

        // An optional slot is NOT disabled — it is a part you may add. Styling it
        // grey-on-grey made it read as unavailable, so it gets the same solid
        // surface and ink as any live row plus an explicit "Add" affordance; only
        // its border stays quiet, because it is not a hole in the build.
        const tone = flagged
          ? 'border-bad bg-surface text-ink'
          : explained
            ? 'border-line-strong bg-surface text-ink hover:border-accent hover:text-accent'
            : isNext
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors
              ${emphasiseMissing ? 'border-dashed' : ''} ${tone}`}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-surface-2 text-[10px] font-mono text-muted shrink-0">{i + 1}</span>
            <CategoryIcon id={cat.id} className={flagged ? 'text-bad' : explained ? 'text-muted' : isNext ? 'text-accent' : 'text-muted'} />
            <span className="flex-1 text-left truncate">{cat.label}</span>
            {explained && (
              <>
                <span className="hidden sm:inline text-[10px] text-faint truncate">{OPTIONAL_NOTE}</span>
                <span className="text-[10px] font-semibold border border-line-strong rounded-full px-2 py-0.5 shrink-0">
                  Optional · Add
                </span>
              </>
            )}
            {flagged && <span className="text-[11px] font-semibold text-bad shrink-0">Missing</span>}
            {isNext && (
              <span className="text-[10px] font-semibold bg-accent text-accent-ink rounded-full px-2 py-0.5 shrink-0">
                Pick one
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
