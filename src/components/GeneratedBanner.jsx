import { X, Zap } from 'lucide-react'
import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import { maxOutBudget } from '../lib/maxOutBudget'
import { PANEL_STRONG, TELEMETRY } from '../lib/uiTokens'
import useCatalogStore from '../store/useCatalogStore'
import { USE_CASE_LABEL } from '../lib/buildProfiles'

// One-off summary shown after setup generates a build: what it cost, and when
// money is left on the table, a one-click way to spend it.
export default function GeneratedBanner() {
  const info          = useBuilderStore((s) => s.lastGenerated)
  const budget        = useBuilderStore((s) => s.budget)
  const useCase       = useBuilderStore((s) => s.useCase)
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const setBuild      = useBuilderStore((s) => s.setBuild)
  const clear         = useBuilderStore((s) => s.clearLastGenerated)
  const spent         = useBuilderStore(selTotalSpent)
  const partsData     = useCatalogStore((s) => s.parts)

  if (!info) return null

  const leftover = budget - spent

  function spendLeftover() {
    setBuild(maxOutBudget(selectedParts, budget, partsData, useCase))
    clear()
  }

  return (
    <div role="status" className={`${PANEL_STRONG} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5`}>
      <p className="text-xs text-muted">
        {info.useCase
          ? <>Your <span className="text-ink">{USE_CASE_LABEL[info.useCase] ?? info.useCase} build</span> uses <span className={`${TELEMETRY} text-tech font-semibold`}>£{spent.toFixed(0)}</span> of your £{budget.toFixed(0)} budget</>
          : <>Upgrade applied</>}
        {leftover > 0 && <> — <span className={`${TELEMETRY} text-good`}>£{leftover.toFixed(0)}</span> under budget</>}
      </p>
      {leftover > 20 && (
        <button
          onClick={spendLeftover}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-copper hover:brightness-110 text-accent-ink font-semibold transition-colors"
        >
          <Zap size={12} aria-hidden="true" /> Spend the leftover
        </button>
      )}
      <button
        onClick={clear}
        aria-label="Dismiss"
        className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg text-muted hover:text-ink transition-colors"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
