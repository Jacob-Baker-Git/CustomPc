import { Zap } from 'lucide-react'
import useBuilderStore from '../store/useBuilderStore'
import { autoBuild } from '../lib/autoBuilder'
import { BTN_PRIMARY } from '../lib/uiTokens'
import useCatalogStore from '../store/useCatalogStore'

export default function AutoBuildButton() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const budget = useBuilderStore((s) => s.budget)
  const resolution = useBuilderStore((s) => s.resolution)
  const setBuild = useBuilderStore((s) => s.setBuild)
  const partsData = useCatalogStore((s) => s.parts)

  return (
    <button
      onClick={() => setBuild(autoBuild(selectedParts, budget, partsData, resolution))}
      disabled={budget <= 0}
      className={`w-full md:w-auto ${BTN_PRIMARY} text-sm font-medium px-5 py-2 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1.5`}
    >
      <Zap size={14} aria-hidden="true" /> Auto-build
    </button>
  )
}
