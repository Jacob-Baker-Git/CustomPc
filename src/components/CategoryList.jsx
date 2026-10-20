import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../lib/categoryIcons'
import { RECOMMENDED_ORDER, nextRecommended, isOptional } from '../lib/recommendedOrder'
import PartSlot from './PartSlot'
import PartPictogram from './showroom/PartPictogram'

const ORDERED = RECOMMENDED_ORDER
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean)

const OPTIONAL_NOTE = 'Optional: most coolers ship with paste applied'

// `hot`/`onHot` link a seated row to its label on the showroom still (Build
// tab, spec 2026-10-20); left out, the rows are plain.
//
// `emphasiseMissing` is the Build tab's louder treatment: unfilled essentials go
// red and tagged. Off by default, so a list shown anywhere else stays quiet.
//
// The rows are drawn by PartSlot, which turns each one into the connector its
// part plugs into. This list keeps deciding WHICH slots are urgent — a slot
// knows how to draw itself, not whether the build needs it next.
export default function CategoryList({
  selectedParts,
  onSelectCategory,
  onDeselect,
  emphasiseMissing = false,
  hot = null,
  onHot,
}) {
  const next = nextRecommended(selectedParts)
  // One column: hairline rows, no gaps between them (showroom list, spec 2026-10-20).
  return (
    <div className="flex flex-col">
      {ORDERED.map((cat, i) => {
        const part = selectedParts[cat.id]

        if (part) {
          return (
            <PartSlot
              key={cat.id}
              category={cat.id}
              label={cat.label}
              part={part}
              // A seated slot gets the showroom pictogram, brass while its
              // label on the still is lit. Empty slots below keep the plain
              // category icon, tinted by how urgent the gap is.
              icon={<PartPictogram id={cat.id} className={hot === cat.id ? 'text-brass' : ''} />}
              onClick={() => onSelectCategory(cat.id)}
              onRemove={() => onDeselect(cat.id)}
              hot={hot}
              onHot={onHot}
            />
          )
        }

        // Three empty shapes: a real hole (red), the one to do next (brass —
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
                className={flagged ? 'text-bad' : isNext && !explained ? 'text-brass' : 'text-muted'}
              />
            }
            // Shrinkable, and NOT shrink-0: the note is the least important
            // thing in the row, so it must yield width before the label does.
            // With shrink-0 it held its width and truncated "Thermal Paste"
            // down to "T…" instead. `xl` because the two-column layout leaves
            // no room for it below that.
            note={explained && (
              <span className="hidden min-w-0 truncate text-[12px] text-faint xl:inline">{OPTIONAL_NOTE}</span>
            )}
            tag={
              <>
                {explained && (
                  <span className="shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-[12px] font-semibold">
                    Optional · Add
                  </span>
                )}
                {flagged && <span className="shrink-0 text-[12px] font-semibold text-bad">Missing</span>}
                {isNext && (
                  <span className="shrink-0 rounded-full bg-brass px-2 py-0.5 text-[12px] font-semibold text-accent-ink">
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
