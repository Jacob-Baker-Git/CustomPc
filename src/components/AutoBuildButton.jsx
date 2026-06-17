import useBuilderStore from '../store/useBuilderStore'
import { autoBuild } from '../lib/autoBuilder'
import partsData from '../data/partsData.json'

export default function AutoBuildButton() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const budget = useBuilderStore((s) => s.budget)
  const resolution = useBuilderStore((s) => s.resolution)
  const setBuild = useBuilderStore((s) => s.setBuild)

  return (
    <button
      onClick={() => setBuild(autoBuild(selectedParts, budget, partsData, resolution))}
      disabled={budget <= 0}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium px-5 py-2 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_22px_rgba(34,211,238,0.6)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
    >
      ⚡ Auto-build
    </button>
  )
}
