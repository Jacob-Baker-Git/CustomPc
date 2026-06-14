import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import { estimateFps } from '../lib/fpsEstimate'
import { buildValuePerPound } from '../lib/valueScore'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export default function PerformancePanel() {
  const cpu        = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu        = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)
  const totalSpent = useBuilderStore(selTotalSpent)

  if (!cpu || !gpu) return null

  const fps   = estimateFps(cpu, gpu, resolution)
  const value = buildValuePerPound(cpu, gpu, totalSpent)
  const resLabel = RES_LABEL[resolution] ?? resolution

  return (
    <div className="absolute top-44 left-4 w-72 bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
      <span className="text-white text-sm font-semibold tracking-wide">Performance</span>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">{fps}</span>
        <span className="text-gray-400 text-xs mb-1">est. avg FPS @ {resLabel}</span>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Value: <span className="text-cyan-300 font-semibold">{value.toFixed(1)}</span> FPS per £100
      </p>
      <p className="mt-1 text-[10px] text-gray-600">Estimated from CPU + GPU performance — not a benchmark.</p>
    </div>
  )
}
