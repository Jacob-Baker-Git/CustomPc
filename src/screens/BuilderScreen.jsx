import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import TopBar from '../components/TopBar'
const BuildCanvas = lazy(() => import('../components/BuildCanvas'))
import BoardBackground from '../components/BoardBackground'
import SiteFooter from '../components/SiteFooter'
import PartSelector from '../components/PartSelector'
import CaseToggle from '../components/CaseToggle'
import InfoDisclaimer from '../components/InfoDisclaimer'
import UseCaseChips from '../components/UseCaseChips'
import BuildRatingPanel from '../components/BuildRatingPanel'
import PeripheralsPanel from '../components/PeripheralsPanel'
import BuildSummary from '../components/BuildSummary'
// Lazy for the same reason BuildCanvas is, and the payload is comparable:
// PerformanceScreen is the only importer of perfModel.json, which is 506 kB of
// fitted model — more than half of what the main bundle used to weigh. It was
// downloaded by everyone who opened the hub, /help or /parts and never went
// near the Performance tab. Splitting it took the entry bundle from 949 kB to
// 502 kB — 192 kB to 137 kB gzipped — with the model landing in its own 448 kB
// chunk that is fetched when the tab is opened.
const PerformanceScreen = lazy(() => import('../components/performance/PerformanceScreen'))
import BuildWarnings from '../components/BuildWarnings'
import AutoBuildButton from '../components/AutoBuildButton'
import SelectedPartsPanel from '../components/SelectedPartsPanel'
import GeneratedBanner from '../components/GeneratedBanner'
import CanvasErrorBoundary from '../components/CanvasErrorBoundary'
import Deferred3D from '../components/Deferred3D'
import ViewTabs from '../components/ViewTabs'
import { useHashView } from '../hooks/useHashView'
import useBuilderStore from '../store/useBuilderStore'
import { PANEL } from '../lib/uiTokens'

// A finger means mobile data, and the 3D view is 11 MB of it. Read once at
// mount rather than as a media query, because this decides whether a component
// MOUNTS — BuildCanvas is lazy(), so not rendering it is what actually keeps
// the chunk and every model off the wire. A CSS rule could only hide them
// after they had already been downloaded.
//
// ⚠️ A mount-time read is acceptable HERE, where the same trick would be wrong
// for the zoom-verb copy below. This decides a download, so it only has to be
// right once, at the moment the panel first renders; the verb has to stay right
// if the pointer type changes under a live page, which only CSS does.
//
// jsdom implements no matchMedia at all, so `?.` resolves this to false there
// and every existing test goes on rendering the canvas exactly as before.
const wantsDeferred3D = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)

export default function BuilderScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const addPart       = useBuilderStore((s) => s.addPart)
  const removePart    = useBuilderStore((s) => s.removePart)
  const [activeCategory, setActiveCategory] = useState(null)
  const [view, setView] = useHashView('build')
  // Opt-in survives tab switches because BuilderScreen itself stays mounted —
  // only its view children swap — and deliberately does NOT survive a reload:
  // a fresh visit on mobile data should be asked again, not charged again.
  const [show3D, setShow3D] = useState(() => !wantsDeferred3D())
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
    <div className="relative min-h-screen">
      {/* No column, so no scrim: this screen covers its viewport in opaque
          panels and has no prose to protect. Dimming the board here would cost
          the artwork and buy nothing. */}
      <BoardBackground />
      <TopBar view={view} onViewChange={setView} />
      {/* pb-16 clears the fixed bottom tab bar wherever it is showing; the extra
          top padding below `wide` clears the header's second row of meters,
          which is taller from `md` up because the header's own padding grows
          there. Measured against the real header: 76px below md, 84px at md–lg,
          90px at lg–wide, 63px above it — so 84 / 96 / 64 of padding clears
          each band. e2e/topBar.spec.js fails if they ever drift apart. */}
      <div ref={scrollRef} className="relative h-screen overflow-y-auto pt-[5.25rem] md:pt-24 wide:pt-16 pb-16 lg:pb-0">
        {/* The one screen that had no h1. Every panel here opens at h2 — "Your
            parts", "Build checks", each Section on the Performance tab — so
            without this the outline a screen reader builds starts inside a
            subsection with no parent. sr-only because the screen has no room
            for a title and does not want one: the tabs say where you are, and
            the header carries the wordmark.

            It stays constant across the four tabs on purpose. The tab control
            is what changes, and it is already announced; a heading that
            renamed itself under the reader would be the noisier choice. */}
        <h1 className="sr-only">Your PC build</h1>
        {view === 'build' ? (
          // Gutters grow with the window so the panels never sit flush against
          // the screen edge, but stay far smaller than the old max-w-6xl, which
          // wasted most of a wide display.
          <div className="relative z-10 transform-gpu w-full max-w-2xl lg:max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10 2xl:px-14 pt-3 pb-12">
            <div className="build-grid">
              {/* The desktop floor is in PIXELS, deliberately. It used to be
                  65vh, and a vh floor on a row whose other cell is sized by text
                  means zooming out grows the row while the text column stays put
                  — 512px of dead space below the score at a 2400px-tall viewport.
                  A px floor only bites when the left column is genuinely short
                  (an empty build), which is the only case it was ever for. */}
              {/* Bordered on purpose. The canvas swallows the scroll wheel to
                  zoom, so without a visible edge people cannot tell where the
                  page stops scrolling and the model starts — they scroll, the
                  build spins, and it reads as a bug. The frame plus the hint
                  below say "this rectangle is the 3D toy, everything outside
                  it is the page". */}
              <div className={`area-viz ${PANEL} relative h-[42vh] md:h-[48vh] lg:h-auto lg:min-h-[520px] hover:border-line-strong transition-colors overflow-hidden`}>
                {show3D ? (
                  <>
                    <CanvasErrorBoundary>
                      <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-muted text-sm motion-safe:animate-pulse">Assembling 3D…</div>}>
                        <BuildCanvas selectedParts={selectedParts} />
                      </Suspense>
                    </CanvasErrorBoundary>
                    <InfoDisclaimer />
                  </>
                ) : (
                  <Deferred3D onLoad={() => setShow3D(true)} />
                )}
                {/* ⚠️ ONE row, not two independently-pinned corners.

                    The hint and the toggle used to be separate absolutely-
                    positioned children — bottom-3 left-3 and bottom-3 right-3 —
                    which gave them no layout relationship at all, so nothing
                    stopped them sliding into each other as the panel narrowed.
                    Together they want ~359px; the panel is the viewport minus
                    47, so every phone was short. Measured overlap: 72.8px at
                    320, 32.8px at 375, 2.8px at 390 — the hint's opaque
                    bg-surface sliced straight through the button.

                    A flex row cannot overlap: when the two no longer fit they
                    wrap instead, and because the row is anchored at the bottom
                    it grows UPWARD, so the toggle keeps its corner and the hint
                    stacks above it. That is a guarantee at every width rather
                    than a breakpoint that has to be re-guessed for the next
                    phone. Guarded by e2e/mobileLayout.spec.js; jsdom computes
                    no layout and cannot see any of it.

                    pointer-events-none stays on the ROW so it never eats a drag
                    aimed at the model underneath; the toggle re-enables them for
                    itself alone. */}
                {/* The controls are gated with the canvas: a drag hint and a
                    see-through-case toggle floating over an empty panel are
                    chrome for something that is not there yet. */}
                {show3D && (
                  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex flex-wrap items-end justify-between gap-2">
                    {/* ⚠️ The VERB is per-input, and the whole reason this hint
                        exists is a mouse problem: the canvas swallows the scroll
                        wheel, so without a frame and a label people scroll, the
                        build spins, and it reads as a bug. A finger has no scroll
                        wheel — on touch the same confusion is real but the gesture
                        is a pinch, so "scroll to zoom" was instructing phone users
                        to do something impossible. It got worse with the row fix
                        above: the hint now takes a line of its own on a phone, so
                        it was spending real estate to be wrong.

                        Swapped in CSS, not JS, deliberately. (An earlier version
                        of this comment justified that with pre-rendering, which
                        is wrong: prerendered/index.html holds the HUB, and no
                        builder markup is ever in a fragment.) The real reasons
                        are that pointer type can CHANGE under a live page — a
                        tablet gaining a mouse, a laptop folding into a tablet —
                        and CSS re-evaluates while a mount-time matchMedia read
                        would be stuck with whatever was true on first paint.
                        (pointer: coarse) is an arbitrary variant rather than a
                        tailwind.config.js screen, which matters — a new `screens`
                        entry needs a dev-server restart or it emits nothing at
                        all, and a variant that emits nothing fails open, showing
                        BOTH verbs. Guarded by e2e/mobileLayout.spec.js, which
                        drives a real touch device and asserts exactly one. */}
                    <div data-viewport-hint className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-muted">
                      Drag to rotate ·{' '}
                      <span data-zoom-verb="scroll" className="[@media(pointer:coarse)]:hidden">scroll</span>
                      <span data-zoom-verb="pinch" className="hidden [@media(pointer:coarse)]:inline">pinch</span>
                      {' '}to zoom
                    </div>
                    {/* ml-auto so that when the row wraps, the toggle alone on its
                        line still sits right rather than jumping left —
                        justify-between does nothing for a single item on a line. */}
                    <div className="pointer-events-auto ml-auto"><CaseToggle /></div>
                  </div>
                )}
              </div>
              {/* One grid child, two stacked panels. Splitting these back into
                  separate grid rows reintroduces the zoom gap — see index.css. */}
              {/* ⚠️ `display: contents` on mobile (index.css) dissolves this
                  wrapper so the two panels become flex items of .build-grid
                  itself and can be ordered independently — the phone wants the
                  SCORE directly under the 3D view, with the use-case chips
                  after it. On desktop the wrapper returns to a flex column in
                  grid-area `left`, exactly as before.

                  Do NOT "simplify" this by giving both children
                  `grid-area: left`. Two items in one named grid area OVERLAP —
                  measured: both reported top=8 — so the chips print on top of
                  the score. */}
              <div className="area-left flex flex-col gap-3">
                <div className="area-usecase"><UseCaseChips /></div>
                <div className="area-rating"><BuildRatingPanel /></div>
              </div>
              <div className="area-banner"><GeneratedBanner /></div>
              <div className="area-parts">
                <SelectedPartsPanel
                  selectedParts={selectedParts}
                  onSelectCategory={setActiveCategory}
                  onDeselect={removePart}
                />
              </div>
              <div className="area-warnings"><BuildWarnings /></div>
              <div className="area-autobuild"><AutoBuildButton /></div>
            </div>
          </div>
        ) : view === 'peripherals' ? (
          <PeripheralsPanel />
        ) : view === 'performance' ? (
          /* The fallback needs its own surface for the same reason every panel
             on this screen does — there is no scrim here, so bare text sits on
             the board. Easy to miss because it is only on screen while the
             chunk loads: e2e/builderLegibility.spec.js caught it under
             full-suite load, having never seen it when run alone. */
          <Suspense fallback={
            <div className="mx-4 my-3 rounded-xl bg-surface p-6 text-sm text-muted motion-safe:animate-pulse sm:mx-6 lg:mx-10">
              Working out frame rates…
            </div>
          }>
            <PerformanceScreen />
          </Suspense>
        ) : (
          <BuildSummary />
        )}

        {/* Inside the scroller, not beside it: this screen's scroll container is
            the h-screen div, so a footer outside it would sit off the bottom of
            the viewport and never be reachable. The container's own pb-16
            already clears the fixed tab bar below lg.

            FULL WIDTH on purpose — this is the one screen with no scrim, so the
            footer's own ground band is what protects its text from the board.
            Cropping it to a text column would leave the edge-pinned hardware
            layers, and their solid gold, showing on either side of it. */}
        <div className="relative z-10">
          <SiteFooter />
        </div>
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
