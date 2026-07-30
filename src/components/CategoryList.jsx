import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../lib/categoryIcons'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

// Hovering a row used to highlight the matching part in the 3D view. That
// highlight was removed, and these handlers went with it rather than being left
// writing to a store field nobody reads — see PartModel.
export default function CategoryList({ selectedParts, onSelectCategory, onDeselect, columns = 1 }) {
  const next = nextRecommended(selectedParts)
  const wrap = columns === 2 ? 'grid grid-cols-1 lg:grid-cols-2 gap-2' : 'space-y-2'

  return (
    <div className={wrap}>
      {ORDERED.map((cat, i) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next

        if (part) {
          return (
            <div key={cat.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <button onClick={() => onSelectCategory(cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <CategoryIcon id={cat.id} className="text-muted" />
                <span className="text-sm text-ink truncate">{part.name}</span>
              </button>
              <span className="font-mono tabular-nums text-sm text-accent shrink-0">£{part.price.toFixed(0)}</span>
              <button onClick={() => onDeselect(cat.id)} aria-label={`Remove ${cat.label}`} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-bad text-sm shrink-0 transition-colors">&times;</button>
            </div>
          )
        }

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors
              ${isNext
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'}`}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-surface-2 text-[10px] font-mono text-muted shrink-0">{i + 1}</span>
            <CategoryIcon id={cat.id} className={isNext ? 'text-accent' : 'text-muted'} />
            <span className="flex-1 text-left">{cat.label}</span>
            {isNext && <span className="text-[11px] text-accent font-medium">pick one</span>}
          </button>
        )
      })}
    </div>
  )
}
