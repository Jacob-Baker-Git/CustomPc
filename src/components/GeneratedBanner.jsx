import { X, Zap } from 'lucide-react'
import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import { maxOutBudget } from '../lib/maxOutBudget'
import { PANEL_STRONG, TELEMETRY } from '../lib/uiTokens'
import useCatalogStore from '../store/useCatalogStore'
import { USE_CASE_LABEL } from '../lib/buildProfiles'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

// One-off summary shown after the wizard generates a build: what it achieves
// and, when money is left on the table, a one-click way to spend it on FPS.
export default function GeneratedBanner() {
  const info          = useBuilderStore((s) => s.lastGenerated)
  const budget        = useBuilderStore((s) => s.budget)
  const resolution    = useBuilderStore((s) => s.resolution)
  const useCase       = useBuilderStore((s) => s.useCase)
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const setBuild      = useBuilderStore((s) => s.setBuild)
  const clear         = useBuilderStore((s) => s.clearLastGenerated)
  const spent         = useBuilderStore(selTotalSpent)
  const partsData     = useCatalogStore((s) => s.parts)

  if (!info) return null

  const leftover = budget - spent
  const resLabel = RES_LABEL[resolution] ?? resolution

  function spendLeftover() {
    setBuild(maxOutBudget(selectedParts, budget, partsData, useCase))
    clear()
  }

  return (
    <div role="status" className={`${PANEL_STRONG} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5`}>
      <p className="text-xs text-slate-200">
        {info.useCase
          ? <>Your <span className="text-slate-100">{USE_CASE_LABEL[info.useCase] ?? info.useCase} build</span> uses <span className={`${TELEMETRY} text-cyan-300 font-semibold`}>£{spent.toFixed(0)}</span> of your £{budget.toFixed(0)} budget</>
          : info.estFps != null && info.gameName
            ? (info.met
                ? <>This build hits <span className={`${TELEMETRY} text-cyan-300 font-semibold`}>~{info.estFps} fps</span> in {info.gameName} at {resLabel}</>
                : <>Closest to your {info.targetFps} fps target: <span className={`${TELEMETRY} text-amber-300 font-semibold`}>~{info.estFps} fps</span> in {info.gameName} at {resLabel}</>)
            : <>Upgrade applied</>}
        {info.quality && info.quality !== 'high' && <> on <span className="text-slate-100">{info.quality}</span> settings</>}
        {leftover > 0 && <> — <span className={`${TELEMETRY} text-emerald-300`}>£{leftover.toFixed(0)}</span> under budget</>}
      </p>
      {leftover > 20 && (
        <button
          onClick={spendLeftover}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
        >
          <Zap size={12} aria-hidden="true" /> Spend the leftover
        </button>
      )}
      <button
        onClick={clear}
        aria-label="Dismiss"
        className="ml-auto w-6 h-6 flex items-center justify-center rounded-sm text-slate-400 hover:text-white transition-colors"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
