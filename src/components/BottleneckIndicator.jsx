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
        <span className="text-ink text-sm font-semibold tracking-wide">Bottleneck</span>
        <ResolutionToggle />
      </div>
      {!result ? (
        <p className="text-faint text-xs">Select a CPU and a GPU to see the balance.</p>
      ) : (
        <>
          <div className="h-2 bg-surface-2 rounded-lg overflow-hidden mb-2">
            <div
              className={`h-full rounded-lg transition-all duration-500
                ${result.limitedBy === 'none' ? 'bg-good'
                  : result.limitedBy === 'gpu' ? 'bg-ok'
                  : 'bg-bad'}`}
              style={{ width: `${result.balancePct}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            <span className={`${TELEMETRY} font-semibold text-accent`}>{result.balancePct}%</span>{' '}
            balanced. {result.verdict}
          </p>
        </>
      )}
    </div>
  )
}
