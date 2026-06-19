import { CATEGORIES } from '../lib/categories'
import { RECOMMENDED_ORDER, nextRecommended } from '../lib/recommendedOrder'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

export default function CategoryList({ selectedParts, onSelectCategory, onDeselect }) {
  const next = nextRecommended(selectedParts)

  return (
    <div className="space-y-2">
      {ORDERED.map((cat, i) => {
        const part = selectedParts[cat.id]
        const isNext = cat.id === next

        if (part) {
          return (
            <div key={cat.id} className="flex items-center gap-2 rounded-sm border border-slate-700/70 bg-slate-950/50 px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <button onClick={() => onSelectCategory(cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span>{cat.icon}</span>
                <span className="text-sm text-slate-100 truncate">{part.name}</span>
              </button>
              <span className="font-mono text-sm text-cyan-300 shrink-0">£{part.price.toFixed(0)}</span>
              <button onClick={() => onDeselect(cat.id)} aria-label={`Remove ${cat.label}`} className="w-7 h-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-white hover:bg-red-500/80 text-sm shrink-0">&times;</button>
            </div>
          )
        }

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-all
              ${isNext
                ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/40'
                : 'border-slate-800/60 bg-slate-950/40 text-slate-300'}`}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-slate-800 text-[10px] font-mono text-slate-300 shrink-0">{i + 1}</span>
            <span>{cat.icon}</span>
            <span className="flex-1 text-left">{cat.label}</span>
            {isNext && <span className="text-[11px] text-cyan-300">pick one</span>}
          </button>
        )
      })}
    </div>
  )
}
