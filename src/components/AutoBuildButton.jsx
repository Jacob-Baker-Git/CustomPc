import { useState } from 'react'
import { Zap } from 'lucide-react'
import useBuilderStore from '../store/useBuilderStore'
import { buildForUseCase } from '../lib/useCaseBuilder'
import { BTN_PRIMARY, PANEL_STRONG } from '../lib/uiTokens'
import useCatalogStore from '../store/useCatalogStore'

export default function AutoBuildButton() {
  const budget = useBuilderStore((s) => s.budget)
  const useCase = useBuilderStore((s) => s.useCase)
  const setBuild = useBuilderStore((s) => s.setBuild)
  const partsData = useCatalogStore((s) => s.parts)
  const [notice, setNotice] = useState(null)

  function handleClick() {
    // Deliberately NO rng. This used to pass Math.random so repeated clicks gave
    // a varied build — "try again" rather than "the answer". Twelve clicks at
    // £1700 gaming produced twelve different PCs, which reads as the tool being
    // unsure rather than as choice. There is one best build for a budget and a
    // use case, and clicking again should confirm it, not reroll it.
    //
    // autoBuild still accepts an `rng` for anyone who wants spread; nothing in
    // the UI passes one.
    const result = buildForUseCase(budget, useCase, partsData)
    const spend = Object.values(result).reduce((s, p) => s + (p?.price ?? 0), 0)
    if (spend > budget) {
      // chooseBest's cheapest fallback overshoots when the budget can't complete a
      // build — surface that instead of applying an over-budget rig.
      setNotice(`£${budget.toFixed(0)} isn't enough to auto-build a complete PC yet. Raise the budget by clicking the £ figure in the header.`)
      return
    }
    setBuild(result)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={budget <= 0}
        className={`w-full md:w-auto ${BTN_PRIMARY} text-sm px-5 py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1.5`}
      >
        <Zap size={14} aria-hidden="true" /> Auto-build
      </button>
      {notice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Auto-build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-ink text-sm font-semibold mb-2">Budget too low</h3>
            <p className="text-xs text-muted">{notice}</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setNotice(null)}
                className="text-xs px-3.5 py-2 rounded-lg bg-copper hover:brightness-110 text-accent-ink font-semibold transition-colors"
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
