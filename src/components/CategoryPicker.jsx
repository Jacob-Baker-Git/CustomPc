export const CATEGORIES = [
  { id: 'cpu',         label: 'CPU',         icon: '⚙️' },
  { id: 'gpu',         label: 'GPU',          icon: '🖥️' },
  { id: 'motherboard', label: 'Motherboard',  icon: '🔌' },
  { id: 'ram',         label: 'RAM',          icon: '📊' },
  { id: 'storage',     label: 'Storage',      icon: '💾' },
  { id: 'psu',         label: 'PSU',          icon: '⚡' },
  { id: 'case',        label: 'Case',         icon: '📦' },
  { id: 'cooler',      label: 'CPU Cooler',   icon: '❄️' },
]

export default function CategoryPicker({ selectedParts, onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 pt-16">
      <h2 className="text-white text-2xl font-bold mb-2">Choose where to start</h2>
      <p className="text-gray-400 mb-8">Pick any component to begin your build</p>
      <div className="grid grid-cols-4 gap-4 max-w-2xl w-full px-6">
        {CATEGORIES.map((cat) => {
          const isSelected = Boolean(selectedParts[cat.id])
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-gray-700 bg-gray-800 text-gray-200 hover:border-gray-500 hover:bg-gray-700'
                }`}
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-sm font-medium">{cat.label}</span>
              {isSelected && (
                <span className="text-xs text-blue-300 truncate max-w-full px-1 text-center">
                  {selectedParts[cat.id].name.split(' ').slice(0, 3).join(' ')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
