import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../lib/categoryIcons'
import { RECOMMENDED_ORDER, nextRecommended, isOptional } from '../lib/recommendedOrder'
import PartSlot from './PartSlot'

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
//
// The rows are drawn by PartSlot, which turns each one into the connector its
// part plugs into. This list keeps deciding WHICH slots are urgent — a slot
// knows how to draw itself, not whether the build needs it next.
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

        if (part) {
          return (
            <PartSlot
              key={cat.id}
              category={cat.id}
              label={cat.label}
              part={part}
              icon={<CategoryIcon id={cat.id} className="text-muted" />}
              onClick={() => onSelectCategory(cat.id)}
              onRemove={() => onDeselect(cat.id)}
            />
          )
        }

        // Three empty shapes: a real hole (red), the one to do next (copper —
        // it is a prompt to ACT, not a selection, so it takes the action metal
        // rather than gold), and a deliberately empty optional slot (neutral,
        // explained).
        const isNext = cat.id === next
        const optional = isOptional(cat.id)
        const flagged = emphasiseMissing && !optional
        const explained = emphasiseMissing && optional

        // An optional slot is NOT disabled — it is a part you may add. Styling it
        // grey-on-grey made it read as unavailable, so it gets an explicit "Add"
        // affordance; only its border stays quiet, because it is not a hole in
        // the build.
        const tone = flagged ? 'flagged' : explained ? 'optional' : isNext ? 'next' : 'empty'

        return (
          <PartSlot
            key={cat.id}
            category={cat.id}
            label={cat.label}
            tone={tone}
            index={i + 1}
            icon={
              <CategoryIcon
                id={cat.id}
                className={flagged ? 'text-bad' : isNext && !explained ? 'text-copper' : 'text-muted'}
              />
            }
            // Shrinkable, and NOT shrink-0: the note is the least important
            // thing in the row, so it must yield width before the label does.
            // With shrink-0 it held its width and truncated "Thermal Paste"
            // down to "T…" instead. `xl` because the two-column layout leaves
            // no room for it below that.
            note={explained && (
              <span className="hidden min-w-0 truncate text-[10px] text-faint xl:inline">{OPTIONAL_NOTE}</span>
            )}
            tag={
              <>
                {explained && (
                  <span className="shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-[10px] font-semibold">
                    Optional · Add
                  </span>
                )}
                {flagged && <span className="shrink-0 text-[11px] font-semibold text-bad">Missing</span>}
                {isNext && (
                  <span className="shrink-0 rounded-full bg-copper px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
                    Pick one
                  </span>
                )}
              </>
            }
            onClick={() => onSelectCategory(cat.id)}
          />
        )
      })}
    </div>
  )
}
