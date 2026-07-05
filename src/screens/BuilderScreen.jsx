import { useState, lazy, Suspense } from 'react'
import TopBar from '../components/TopBar'
const BuildCanvas = lazy(() => import('../components/BuildCanvas'))
import Backdrop from '../components/Backdrop'
import OrbitRing from '../components/OrbitRing'
import PartSelector from '../components/PartSelector'
import CaseToggle from '../components/CaseToggle'
import InfoDisclaimer from '../components/InfoDisclaimer'
import UpgradeSuggestion from '../components/UpgradeSuggestion'
import BottleneckIndicator from '../components/BottleneckIndicator'
import PerformancePanel from '../components/PerformancePanel'
import PeripheralsPanel from '../components/PeripheralsPanel'
import BuildSummary from '../components/BuildSummary'
import BuildWarnings from '../components/BuildWarnings'
import AutoBuildButton from '../components/AutoBuildButton'
import GamePerformancePanel from '../components/GamePerformancePanel'
import SavedBuilds from '../components/SavedBuilds'
import CategoryList from '../components/CategoryList'
import GeneratedBanner from '../components/GeneratedBanner'
import CanvasErrorBoundary from '../components/CanvasErrorBoundary'
import { useIsMobile } from '../hooks/useIsMobile'
import { useHashView } from '../hooks/useHashView'
import useBuilderStore from '../store/useBuilderStore'

export default function BuilderScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const removePart    = useBuilderStore((s) => s.removePart)
  const [activeCategory, setActiveCategory] = useState(null)
  const [view, setView] = useHashView('build')
  const isMobile = useIsMobile()

  function handlePartSelect(part) {
    addPart(part.category, part)
    setActiveCategory(null)
  }

  return (
    <div className="relative min-h-screen bg-[#05080f]">
      <Backdrop />
      <TopBar />
      <div className="pt-16 h-[calc(100vh-4rem)]">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 inline-flex rounded-sm bg-slate-950/30 backdrop-blur-md border border-slate-800/60 p-0.5">
          {['build', 'peripherals', 'summary', 'saved'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 md:px-4 py-1 text-[11px] md:text-xs font-medium rounded-sm capitalize transition-all
                ${view === v
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-300 hover:text-white'}`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === 'build' ? (
          isMobile ? (
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="relative h-[45vh] shrink-0">
                <CanvasErrorBoundary>
                  <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm motion-safe:animate-pulse">Assembling 3D…</div>}>
                    <BuildCanvas selectedParts={selectedParts} />
                  </Suspense>
                </CanvasErrorBoundary>
                <div className="absolute bottom-3 right-3"><CaseToggle /></div>
              </div>
              {/* relative z + own compositing layer: static content after a WebGL
                  canvas can otherwise be composited underneath it. */}
              <div className="relative z-10 transform-gpu p-4 space-y-3 pb-12">
                <GeneratedBanner />
                <CategoryList
                  selectedParts={selectedParts}
                  onSelectCategory={setActiveCategory}
                  onDeselect={removePart}
                />
                <BottleneckIndicator />
                <PerformancePanel />
                <GamePerformancePanel />
                <BuildWarnings />
                <UpgradeSuggestion />
                <AutoBuildButton />
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <div className="absolute top-32 left-1/2 -translate-x-1/2 z-40 w-[min(92%,660px)]"><GeneratedBanner /></div>
              <CanvasErrorBoundary>
                <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm motion-safe:animate-pulse">Assembling 3D…</div>}>
                  <BuildCanvas selectedParts={selectedParts} />
                </Suspense>
              </CanvasErrorBoundary>
              <div className="absolute top-4 left-4 w-72"><BottleneckIndicator /></div>
              <div className="absolute top-44 left-4 w-72"><PerformancePanel /></div>
              <div className="absolute top-4 right-4 w-72"><GamePerformancePanel /></div>
              <OrbitRing
                selectedParts={selectedParts}
                onSelectCategory={setActiveCategory}
                onDeselect={removePart}
              />
              <div className="absolute bottom-6 right-6"><CaseToggle /></div>
              <InfoDisclaimer />
              <div className="absolute bottom-6 left-6 w-80"><UpgradeSuggestion /></div>
              <div className="absolute top-80 left-4 w-72"><BuildWarnings /></div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40"><AutoBuildButton /></div>
            </div>
          )
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : view === 'summary' ? (
          <BuildSummary />
        ) : (
          <SavedBuilds onLoaded={() => setView('build')} />
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
