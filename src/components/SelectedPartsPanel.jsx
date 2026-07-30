import CategoryList from './CategoryList'
import { countEssentials } from '../lib/recommendedOrder'
import { PANEL, TELEMETRY } from '../lib/uiTokens'

// The Build tab's framing for CategoryList. It lives here rather than inside
// CategoryList because SetupFlow renders that same list for "the PC I already
// own", where a completeness counter would be meaningless.
export default function SelectedPartsPanel({ selectedParts, onSelectCategory, onDeselect }) {
  const { chosen, total, missing } = countEssentials(selectedParts)
  const spend = Object.values(selectedParts).reduce((sum, p) => sum + (p?.price ?? 0), 0)

  return (
    <section className={`${PANEL} p-4`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <h2 className="font-display text-base font-bold text-ink">Your parts</h2>
        <span className="text-xs text-muted">{chosen} of {total} essentials chosen</span>
        {missing.length > 0 ? (
          <span className="text-xs font-semibold text-bad">
            {missing.length} missing
          </span>
        ) : (
          <span className="text-xs font-semibold text-good">All essentials covered</span>
        )}
        <span className={`ml-auto ${TELEMETRY} text-sm font-semibold text-accent`}>£{spend.toFixed(0)}</span>
      </div>
      <CategoryList
        selectedParts={selectedParts}
        onSelectCategory={onSelectCategory}
        onDeselect={onDeselect}
        columns={2}
        emphasiseMissing
      />
    </section>
  )
}
