import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import TopBar from '../components/TopBar'
const BuildCanvas = lazy(() => import('../components/BuildCanvas'))
import Backdrop from '../components/Backdrop'
import PartSelector from '../components/PartSelector'
import CaseToggle from '../components/CaseToggle'
import InfoDisclaimer from '../components/InfoDisclaimer'
import UpgradeSuggestion from '../components/UpgradeSuggestion'
import BuildRatingPanel from '../components/BuildRatingPanel'
import PeripheralsPanel from '../components/PeripheralsPanel'
import BuildSummary from '../components/BuildSummary'
import BuildWarnings from '../components/BuildWarnings'
import AutoBuildButton from '../components/AutoBuildButton'
import CategoryList from '../components/CategoryList'
import GeneratedBanner from '../components/GeneratedBanner'
import CanvasErrorBoundary from '../components/CanvasErrorBoundary'
import ViewTabs from '../components/ViewTabs'
import { useHashView } from '../hooks/useHashView'
import useBuilderStore from '../store/useBuilderStore'

export default function BuilderScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const removePart    = useBuilderStore((s) => s.removePart)
  const setHovered    = useBuilderStore((s) => s.setHoveredCategory)
  const [activeCategory, setActiveCategory] = useState(null)
  const [view, setView] = useHashView('build')
  const scrollRef = useRef(null)

  // Fresh views (and the first landing after setup) start at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [view])

  function handlePartSelect(part) {
    addPart(part.category, part)
    setActiveCategory(null)
  }

  return (
    <div className="relative min-h-screen bg-ground">
      <Backdrop />
      <TopBar view={view} onViewChange={setView} />
      {/* pb-16 clears the fixed bottom tab bar wherever it is showing. */}
      <div ref={scrollRef} className="relative h-screen overflow-y-auto pt-16 pb-16 lg:pb-0">
        {view === 'build' ? (
          <div className="relative z-10 transform-gpu w-full max-w-2xl lg:max-w-6xl 2xl:max-w-[88rem] mx-auto p-4 pt-3 pb-12">
            <div className="build-grid">
              <div className="area-viz relative h-[42vh] md:h-[48vh] lg:h-full lg:min-h-[60vh]">
                <CanvasErrorBoundary>
                  <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-muted text-sm motion-safe:animate-pulse">Assembling 3D…</div>}>
                    <BuildCanvas selectedParts={selectedParts} />
                  </Suspense>
                </CanvasErrorBoundary>
                <InfoDisclaimer />
                <div className="absolute bottom-3 right-3"><CaseToggle /></div>
              </div>
              <div className="area-banner"><GeneratedBanner /></div>
              <div className="area-parts">
                <CategoryList
                  selectedParts={selectedParts}
                  onSelectCategory={setActiveCategory}
                  onDeselect={removePart}
                  onHoverCategory={setHovered}
                  columns={2}
                />
              </div>
              <div className="area-rating"><BuildRatingPanel /></div>
              <div className="area-warnings"><BuildWarnings /></div>
              <div className="area-upgrade"><UpgradeSuggestion /></div>
              <div className="area-autobuild"><AutoBuildButton /></div>
            </div>
          </div>
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : (
          <BuildSummary />
        )}
      </div>
      <ViewTabs view={view} onChange={setView} variant="bar" />
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
