import { COMPACT_IDS } from '../../lib/showroom.js'
import { categoryLabel } from '../../lib/categories.js'
import PartPictogram from './PartPictogram.jsx'

const gbp = (n) => `£${Number(n ?? 0).toLocaleString('en-GB')}`

export default function ShowroomTapStrip({ parts, hot }) {
  const sel = hot && COMPACT_IDS.includes(hot) && parts?.[hot] ? hot : null
  return (
    <div data-tap-strip className="flex min-h-16 items-center gap-3 border-t border-brass bg-surface px-4 py-3">
      {sel ? (
        <>
          <PartPictogram id={sel} className="h-7 w-7 shrink-0 text-brass" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] uppercase tracking-wide text-brass">{categoryLabel(sel)}</div>
            <div className="text-sm">{parts[sel].name}</div>
          </div>
          <span className="text-base">{gbp(parts[sel].price)}</span>
        </>
      ) : (
        <span className="text-[12px] uppercase tracking-wide text-muted">Tap a number to see the part</span>
      )}
    </div>
  )
}
