import useBuilderStore from '../store/useBuilderStore'
import { computeBottleneck } from '../lib/bottleneck'
import ResolutionToggle from './ResolutionToggle'

export default function BottleneckIndicator() {
  const cpu        = useBuilderStore((s) => s.selectedParts.cpu)
  const gpu        = useBuilderStore((s) => s.selectedParts.gpu)
  const resolution = useBuilderStore((s) => s.resolution)

  const result = computeBottleneck(cpu, gpu, resolution)

  return (
    <div className="absolute top-4 left-4 w-72 bg-gray-900/90 border border-gray-700 rounded-xl p-4 backdrop-blur">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white text-sm font-semibold">Bottleneck</span>
        <ResolutionToggle />
      </div>
      {!result ? (
        <p className="text-gray-500 text-xs">Select a CPU and a GPU to see the balance.</p>
      ) : (
        <>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500
                ${result.balancePct >= 85 ? 'bg-green-500' : result.balancePct >= 70 ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${result.balancePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-300">
            <span className="font-semibold text-white">{result.balancePct}% balanced.</span>{' '}
            {result.verdict}
          </p>
        </>
      )}
    </div>
  )
}
