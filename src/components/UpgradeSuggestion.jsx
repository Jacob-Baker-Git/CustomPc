import { Zap } from 'lucide-react'
import useBuilderStore from '../store/useBuilderStore'
import { suggestUpgrade } from '../lib/upgradeAdvisor'
import partsData from '../data/partsData.json'
import { PANEL, TELEMETRY, BTN_PRIMARY } from '../lib/uiTokens'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export default function UpgradeSuggestion() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const budget        = useBuilderStore((s) => s.budget)
  const resolution    = useBuilderStore((s) => s.resolution)
  const addPart       = useBuilderStore((s) => s.addPart)

  const s = suggestUpgrade(selectedParts, budget, partsData, resolution)
  if (!s) return null

  const resLabel = RES_LABEL[resolution] ?? resolution
  const cost = s.extraCost <= 0 ? 'no extra cost' : `+£${s.extraCost.toFixed(0)}`

  return (
    <div className={`${PANEL} p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <Zap size={14} className="text-cyan-300" aria-hidden="true" />
        <span className="text-white text-sm font-semibold">Upgrade suggestion</span>
      </div>
      <p className="text-xs text-gray-300">
        Swap your <span className="uppercase">{s.category}</span> →{' '}
        <span className="text-cyan-300 font-semibold">{s.toPart.name}</span> for{' '}
        <span className={`${TELEMETRY} text-emerald-300 font-semibold`}>+{s.fpsGain} FPS</span> at {resLabel} ({cost}).
      </p>
      <button
        onClick={() => addPart(s.category, s.toPart)}
        className={`mt-3 w-full ${BTN_PRIMARY} text-sm font-medium py-1.5 rounded-sm transition-colors`}
      >
        Apply upgrade
      </button>
    </div>
  )
}
