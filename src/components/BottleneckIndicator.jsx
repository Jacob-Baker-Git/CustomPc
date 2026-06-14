import useBuilderStore from '../store/useBuilderStore'
import { computeBottleneck } from '../lib/bottleneck'
import ResolutionToggle from './ResolutionToggle'

export default function BottleneckIndicator() {
  const cpu        = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu        = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)

  const result = computeBottleneck(cpu, gpu, resolution)

  return (
    <div className="absolute top-4 left-4 w-72 bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-semibold tracking-wide">Bottleneck</span>
        <ResolutionToggle />
      </div>
      {!result ? (
        <p className="text-gray-500 text-xs">Select a CPU and a GPU to see the balance.</p>
      ) : (
        <>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(34,211,238,0.4)]
                ${result.balancePct >= 85 ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                  : result.balancePct >= 70 ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-red-500 to-rose-500'}`}
              style={{ width: `${result.balancePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-300">
            <span className="font-semibold text-cyan-300">{result.balancePct}% balanced.</span>{' '}
            {result.verdict}
          </p>
        </>
      )}
    </div>
  )
}
