import { useState } from 'react'
import CategoryList from './CategoryList'
import ConfirmDialog from './ConfirmDialog'
import useBuilderStore from '../store/useBuilderStore'
import { countEssentials } from '../lib/recommendedOrder'
import { PANEL, TELEMETRY } from '../lib/uiTokens'

// The Build tab's framing for CategoryList. It lives here rather than inside
// CategoryList because SetupFlow renders that same list for "the PC I already
// own", where a completeness counter would be meaningless.
export default function SelectedPartsPanel({ selectedParts, onSelectCategory, onDeselect }) {
  const { chosen, total, missing } = countEssentials(selectedParts)
  const spend = Object.values(selectedParts).reduce((sum, p) => sum + (p?.price ?? 0), 0)

  // Clearing lives here as well as on the Summary tab: this is where people are
  // looking when they decide to start over, and making them cross a tab to do
  // it is the kind of small tax that gets a build abandoned instead of redone.
  const clearBuild = useBuilderStore((s) => s.clearBuild)
  const selectedPeripherals = useBuilderStore((s) => s.selectedPeripherals)
  const [clearOpen, setClearOpen] = useState(false)
  // Peripherals count too — clearBuild empties both, so a build with only a
  // monitor picked still has something to clear.
  const isEmpty =
    Object.values(selectedParts).filter(Boolean).length === 0 &&
    Object.values(selectedPeripherals).filter(Boolean).length === 0

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
        {/* Lifted off the panel with its own surface and carrying the warning
            colour, matching "Clear build" on the Summary tab — a destructive
            action that blends into the card behind it is one people miss. */}
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          disabled={isEmpty}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-2 border border-bad text-bad hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Clear all
        </button>
      </div>
      <CategoryList
        selectedParts={selectedParts}
        onSelectCategory={onSelectCategory}
        onDeselect={onDeselect}
        columns={2}
        emphasiseMissing
      />

      {clearOpen && (
        <ConfirmDialog
          title="Clear the whole build?"
          ariaLabel="Clear build"
          body="This removes every selected part and peripheral. Saved builds are kept."
          confirmLabel="Clear everything"
          onConfirm={() => { clearBuild(); setClearOpen(false) }}
          onCancel={() => setClearOpen(false)}
        />
      )}
    </section>
  )
}
