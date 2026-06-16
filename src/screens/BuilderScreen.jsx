import { useState } from 'react'
import TopBar from '../components/TopBar'
import BuildCanvas from '../components/BuildCanvas'
import OrbitRing from '../components/OrbitRing'
import PartSelector from '../components/PartSelector'
import CaseToggle from '../components/CaseToggle'
import InfoDisclaimer from '../components/InfoDisclaimer'
import UpgradeSuggestion from '../components/UpgradeSuggestion'
import BottleneckIndicator from '../components/BottleneckIndicator'
import PerformancePanel from '../components/PerformancePanel'
import PeripheralsPanel from '../components/PeripheralsPanel'
import useBuilderStore from '../store/useBuilderStore'

export default function BuilderScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const removePart    = useBuilderStore((s) => s.removePart)
  const [activeCategory, setActiveCategory] = useState(null)
  const [view, setView] = useState('build')

  function handlePartSelect(part) {
    addPart(part.category, part)
    setActiveCategory(null)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <TopBar />
      <div className="pt-16 h-[calc(100vh-4rem)]">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 inline-flex rounded-sm bg-slate-950/30 backdrop-blur-md border border-slate-800/60 p-0.5">
          {['build', 'peripherals'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1 text-xs font-medium rounded-sm capitalize transition-all
                ${view === v
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'text-gray-300 hover:text-white'}`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === 'build' ? (
          <div className="relative w-full h-full">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 55% 55% at 50% 45%, rgba(45,120,160,0.18), rgba(2,6,23,0) 70%)' }}
            />
            <BuildCanvas selectedParts={selectedParts} />
            <BottleneckIndicator />
            <PerformancePanel />
            <OrbitRing
              selectedParts={selectedParts}
              onSelectCategory={setActiveCategory}
              onDeselect={removePart}
            />
            <CaseToggle />
            <InfoDisclaimer />
            <UpgradeSuggestion />
          </div>
        ) : (
          <PeripheralsPanel />
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
