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
import SavedBuilds from '../components/SavedBuilds'
import CategoryList from '../components/CategoryList'
import GeneratedBanner from '../components/GeneratedBanner'
import CanvasErrorBoundary from '../components/CanvasErrorBoundary'
import { useHashView } from '../hooks/useHashView'
import useBuilderStore from '../store/useBuilderStore'

export default function BuilderScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const removePart    = useBuilderStore((s) => s.removePart)
  const [activeCategory, setActiveCategory] = useState(null)
  const [view, setView] = useHashView('build')
  const scrollRef = useRef(null)

  // Fresh views (and the first landing after the wizard) start at the top —
  // the tabs live in the page flow now, so a stale scroll would hide them.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [view])

  function handlePartSelect(part) {
    addPart(part.category, part)
    setActiveCategory(null)
  }

  return (
    <div className="relative min-h-screen bg-[#05080f]">
      <Backdrop />
      <TopBar />
      {/* One scroll container for tabs + view content, so the tabs scroll away
          with the page instead of floating over it. */}
      <div ref={scrollRef} className="relative h-screen overflow-y-auto pt-16">
        <div className="flex justify-center pt-3 pb-2">
          <div className="inline-flex rounded-sm bg-slate-950/30 backdrop-blur-md border border-slate-800/60 p-0.5">
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
        </div>
        {view === 'build' ? (
          <div className="relative z-10 transform-gpu w-full max-w-2xl lg:max-w-6xl 2xl:max-w-[88rem] mx-auto p-4 pb-12">
            <div className="build-grid">
              <div className="area-viz relative h-[42vh] md:h-[48vh] lg:h-full lg:min-h-[60vh]">
                <CanvasErrorBoundary>
                  <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm motion-safe:animate-pulse">Assembling 3D…</div>}>
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
