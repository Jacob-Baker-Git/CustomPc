import { useState } from 'react'
import TopBar from '../components/TopBar'
import BuildCanvas from '../components/BuildCanvas'
import OrbitRing from '../components/OrbitRing'
import PartSelector from '../components/PartSelector'
import CaseToggle from '../components/CaseToggle'
import UpgradeSuggestion from '../components/UpgradeSuggestion'
import BottleneckIndicator from '../components/BottleneckIndicator'
import PerformancePanel from '../components/PerformancePanel'
import useBuilderStore from '../store/useBuilderStore'

export default function BuilderScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const removePart    = useBuilderStore((s) => s.removePart)
  const [activeCategory, setActiveCategory] = useState(null)

  function handlePartSelect(part) {
    addPart(part.category, part)
    setActiveCategory(null)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <TopBar />
      <div className="pt-16 h-[calc(100vh-4rem)]">
        <div className="relative w-full h-full">
          <BuildCanvas selectedParts={selectedParts} />
          <BottleneckIndicator />
          <PerformancePanel />
          <OrbitRing
            selectedParts={selectedParts}
            onSelectCategory={setActiveCategory}
            onDeselect={removePart}
          />
          <CaseToggle />
          <UpgradeSuggestion />
        </div>
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
