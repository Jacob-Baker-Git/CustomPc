import { useState } from 'react'
import { Zap } from 'lucide-react'
import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import { autoBuild } from '../lib/autoBuilder'
import { BTN_PRIMARY, PANEL_STRONG } from '../lib/uiTokens'
import useCatalogStore from '../store/useCatalogStore'

export default function AutoBuildButton() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const budget = useBuilderStore((s) => s.budget)
  const resolution = useBuilderStore((s) => s.resolution)
  const setBuild = useBuilderStore((s) => s.setBuild)
  const spent = useBuilderStore(selTotalSpent)
  const partsData = useCatalogStore((s) => s.parts)
  const [notice, setNotice] = useState(null)

  function handleClick() {
    const result = autoBuild(selectedParts, budget, partsData, resolution)
    const changed = Object.keys(result).some((c) => result[c]?.id !== selectedParts[c]?.id)
    if (!changed) {
      // Silently doing nothing looks broken — say why instead.
      const remaining = budget - spent
      setNotice(
        remaining <= 0
          ? `Your build already uses the whole £${budget.toFixed(0)} budget, so there's nothing left for auto-build to spend. Raise the budget (click the £ figure in the header) or remove a part first.`
          : `Auto-build couldn't find any compatible part to add or upgrade for the £${remaining.toFixed(0)} you have left. Raise the budget (click the £ figure in the header) or swap a pricey part for a cheaper one.`
      )
      return
    }
    setBuild(result)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={budget <= 0}
        className={`w-full md:w-auto ${BTN_PRIMARY} text-sm font-medium px-5 py-2 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1.5`}
      >
        <Zap size={14} aria-hidden="true" /> Auto-build
      </button>
      {notice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Auto-build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-white text-sm font-semibold mb-2">Nothing to auto-build</h3>
            <p className="text-xs text-slate-400">{notice}</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setNotice(null)}
                className="text-xs px-3.5 py-2 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
