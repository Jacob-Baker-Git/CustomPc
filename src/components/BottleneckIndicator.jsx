import useBuilderStore from '../store/useBuilderStore'
import { computeBottleneck } from '../lib/bottleneck'
import ResolutionToggle from './ResolutionToggle'
import { PANEL, TELEMETRY } from '../lib/uiTokens'

export default function BottleneckIndicator() {
  const cpu        = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu        = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)

  const result = computeBottleneck(cpu, gpu, resolution)

  return (
    <div className={`${PANEL} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-semibold tracking-wide">Bottleneck</span>
        <ResolutionToggle />
      </div>
      {!result ? (
        <p className="text-gray-500 text-xs">Select a CPU and a GPU to see the balance.</p>
      ) : (
        <>
          <div className="h-2 bg-white/10 rounded-sm overflow-hidden mb-2">
            <div
              className={`h-full rounded-sm transition-all duration-500
                ${result.limitedBy === 'none' ? 'bg-emerald-500'
                  : result.limitedBy === 'gpu' ? 'bg-amber-500'
                  : 'bg-red-500'}`}
              style={{ width: `${result.balancePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-300">
            <span className={`${TELEMETRY} font-semibold text-cyan-300`}>{result.balancePct}%</span>{' '}
            balanced. {result.verdict}
          </p>
        </>
      )}
    </div>
  )
}
