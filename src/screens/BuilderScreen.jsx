import { useState } from 'react'
import TopBar from '../components/TopBar'
import BuildCanvas from '../components/BuildCanvas'
import OrbitRing from '../components/OrbitRing'
import PartSelector from '../components/PartSelector'
import CategoryPicker from '../components/CategoryPicker'
import useBuilderStore from '../store/useBuilderStore'

export default function BuilderScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const [activeCategory, setActiveCategory]   = useState(null)
  const [showCategoryPicker, setShowPicker]   = useState(true)

  const hasAnyPart = Object.values(selectedParts).some(Boolean)

  function handleCategorySelect(category) {
    setActiveCategory(category)
    setShowPicker(false)
  }

  function handlePartSelect(part) {
    addPart(part.category, part)
    setActiveCategory(null)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <TopBar />
      <div className="pt-16 h-screen">
        {showCategoryPicker && !hasAnyPart ? (
          <CategoryPicker selectedParts={selectedParts} onSelect={handleCategorySelect} />
        ) : (
          <div className="relative w-full h-full">
            <BuildCanvas selectedParts={selectedParts} />
            <OrbitRing selectedParts={selectedParts} onSelectCategory={handleCategorySelect} />
            <button
              onClick={() => setShowPicker(true)}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-full border border-gray-600 transition-all"
            >
              View All Categories
            </button>
          </div>
        )}
      </div>
      {activeCategory && (
        <PartSelector
          category={activeCategory}
          onSelect={handlePartSelect}
          onClose={() => setActiveCategory(null)}
        />
      )}
    </div>
  )
}
