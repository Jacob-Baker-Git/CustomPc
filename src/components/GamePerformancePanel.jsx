import useBuilderStore from '../store/useBuilderStore'
import GamePerformanceList from './GamePerformanceList'
import { PANEL } from '../lib/uiTokens'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

const LEGEND = [
  ['bg-green-500', '60+ smooth'],
  ['bg-amber-400', '30–59 playable'],
  ['bg-red-500', 'under 30 struggles'],
]

export default function GamePerformancePanel() {
  const cpu = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)

  return (
    <div className={`${PANEL} p-3`}>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
        How it runs @ {RES_LABEL[resolution] ?? resolution}
      </div>
      {!cpu || !gpu ? (
        <p className="text-xs text-slate-500 py-2">Select a CPU + GPU to see game FPS.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-2">
            Based on <span className="text-slate-200">{cpu.name}</span> + <span className="text-slate-200">{gpu.name}</span>
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1">
            {LEGEND.map(([dot, label]) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
          <div className="max-h-[55vh] overflow-y-auto">
            <GamePerformanceList cpu={cpu} gpu={gpu} resolution={resolution} />
          </div>
          <p className="mt-2 text-[10px] text-gray-600">
            Estimated averages at high settings — not a benchmark. Real FPS varies with settings and drivers.
          </p>
        </>
      )}
    </div>
  )
}
