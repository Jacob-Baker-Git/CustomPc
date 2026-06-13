import useBuilderStore, {
  selTotalSpent, selTotalPower, selPsuWattage
} from '../store/useBuilderStore'
import DynamicBars from './DynamicBars'

export default function TopBar() {
  const budget     = useBuilderStore((s) => s.budget)
  const totalSpent = useBuilderStore(selTotalSpent)
  const totalPower = useBuilderStore(selTotalPower)
  const psuwattage = useBuilderStore(selPsuWattage)
  const remaining  = budget - totalSpent

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
      <span className="text-white font-bold text-lg tracking-tight">PC Builder</span>
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <span className="text-white font-semibold">£{budget.toFixed(0)}</span>
        <span className="text-gray-500">budget</span>
        <span className="text-gray-600 mx-1">|</span>
        <span className={remaining < 0 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
          £{remaining.toFixed(0)}
        </span>
        <span className="text-gray-500">remaining</span>
        <span className="text-gray-600 mx-1">|</span>
        <span className="text-amber-400 font-semibold">{totalPower}W</span>
      </div>
      <div className="flex gap-6 ml-auto">
        <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
        <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
      </div>
    </header>
  )
}
