import useBuilderStore from '../store/useBuilderStore'
import GamePerformanceList from './GamePerformanceList'
import { PANEL } from '../lib/uiTokens'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

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
        <div className="max-h-[55vh] overflow-y-auto">
          <GamePerformanceList cpu={cpu} gpu={gpu} resolution={resolution} />
        </div>
      )}
    </div>
  )
}
