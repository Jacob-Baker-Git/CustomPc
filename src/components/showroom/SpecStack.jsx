import useBuilderStore, { selTotalSpent } from '../../store/useBuilderStore'
// power.js directly, not the perfEngine index: power.js needs only catalogue
// fields, and Summary must never pull perfModel.json (506 kB) into its bundle.
import { estimatePower, estimateThermals } from '../../lib/perfEngine/power'

const signed = (n) => (n == null ? null : `${n > 0 ? '+' : ''}${n}%`)
const watts = (n) => (n ? `${n} W` : null)

// Summary's figures in big mono numbers (spec 2026-10-20). Only what the site
// already computes for this build. `column` is the desktop stack beside the 3D
// view; `grid` the phone's three-across grid under it.
export default function SpecStack({ layout = 'column' }) {
  const parts = useBuilderStore((s) => s.selectedParts)
  const budget = useBuilderStore((s) => s.budget)
  const total = useBuilderStore(selTotalSpent)
  const power = estimatePower(parts)
  const thermals = estimateThermals(parts)

  const fields = [
    ['Price', `£${total.toFixed(0)}${budget > 0 ? ` / £${budget.toFixed(0)}` : ''}`],
    ['Peak power', watts(power.peakW)],
    ['PSU', watts(power.psuWattage)],
    ['PSU headroom', signed(power.psuHeadroomPct)],
    ['Cooling margin', signed(thermals.headroomPct)],
  ]

  const grid = layout === 'grid'
  return (
    <section aria-label="Spec" className={grid ? 'grid grid-cols-3 border-l border-t border-line' : 'flex h-full flex-col'}>
      {!grid && <h2 className="pb-2 font-mono text-[12px] uppercase tracking-wider text-muted">Spec</h2>}
      {/* On the grid Price spans two cells: "£1594 / £1600" does not fit one
          third of a phone, and five figures in three columns leave a hole. */}
      {fields.map(([label, value], i) => (
        <div
          key={label}
          className={grid
            ? `min-w-0 border-b border-r border-line px-2 py-1 ${i === 0 ? 'col-span-2' : ''}`
            : 'flex flex-1 flex-col justify-center border-t border-line py-3'}
        >
          <div className={`whitespace-nowrap font-mono text-[12px] uppercase text-muted ${grid ? '' : 'tracking-wider'}`}>{label}</div>
          <div className={`font-mono font-bold text-ink ${grid ? 'text-base leading-snug' : 'text-3xl'}`}>{value ?? '—'}</div>
        </div>
      ))}
    </section>
  )
}
