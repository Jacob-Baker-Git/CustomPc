import { useMemo } from 'react'
import { checkCompatibility } from '../lib/compatibility'
import useBuilderStore, { selRemainingBudget } from '../store/useBuilderStore'
import PartCard from './PartCard'
import partsData from '../data/partsData.json'

export default function PartSelector({ category, onSelect, onClose }) {
  const selectedParts   = useBuilderStore((s) => s.selectedParts)
  const remainingBudget = useBuilderStore(selRemainingBudget)

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [category]
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white text-xl font-bold capitalize">{category}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {parts.map((part) => {
            const { compatible, reason } = checkCompatibility(selectedParts, part)
            const overBudget = part.price > remainingBudget
            const locked     = !compatible || overBudget
            const lockReason = !compatible ? reason : 'Over remaining budget'
            return (
              <PartCard
                key={part.id}
                part={part}
                locked={locked}
                lockReason={lockReason}
                onSelect={(p) => { onSelect(p); onClose() }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
