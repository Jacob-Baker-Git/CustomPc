import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import { estimateFps } from '../lib/fpsEstimate'
import { buildValuePerPound } from '../lib/valueScore'
import { PANEL, TELEMETRY } from '../lib/uiTokens'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export default function PerformancePanel() {
  const cpu        = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu        = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)
  const totalSpent = useBuilderStore(selTotalSpent)

  if (!cpu || !gpu) return null

  const fps   = estimateFps(cpu, gpu, resolution)
  const value = buildValuePerPound(cpu, gpu, totalSpent, resolution)
  const resLabel = RES_LABEL[resolution] ?? resolution

  return (
    <div className={`${PANEL} p-4`}>
      <span className="text-white text-sm font-semibold tracking-wide">Performance</span>
      <div className="mt-2 flex items-end gap-2">
        <span className={`${TELEMETRY} text-3xl font-bold text-cyan-300`}>{fps}</span>
        <span className="text-gray-400 text-xs mb-1">est. avg FPS @ {resLabel}</span>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Value: <span className={`${TELEMETRY} text-cyan-300 font-semibold`}>{value.toFixed(1)}</span> FPS per £100 @ {resLabel}
      </p>
      <p className="mt-1 text-[10px] text-gray-600">Estimated from CPU + GPU performance — not a benchmark.</p>
    </div>
  )
}
