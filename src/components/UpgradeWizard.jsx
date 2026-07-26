import { useState } from 'react'
import Backdrop from './Backdrop'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { decodeBuild } from '../lib/buildCodec'
import { BUILD_PROFILES, USE_CASES } from '../lib/buildProfiles'
import { enterBuildTab } from '../lib/enterBuildTab'
import { PANEL, BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'

const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

export default function UpgradeWizard({ onBack }) {
  const [screen, setScreen] = useState('specs')      // 'specs' | 'usecase'
  const [tab, setTab] = useState('build')
  const [currentParts, setCurrentParts] = useState({})
  const [savedSelectedId, setSavedSelectedId] = useState(null)
  const [pickerCategory, setPickerCategory] = useState(null)
  const [useCase, setUseCase] = useState('gaming')

  const saved     = useSavedStore((s) => s.saved)
  const setBuild           = useBuilderStore((s) => s.setBuild)
  const setBudget          = useBuilderStore((s) => s.setBudget)
  const setStoreResolution = useBuilderStore((s) => s.setResolution)
  const setStoreUseCase    = useBuilderStore((s) => s.setUseCase)
  const setLastGenerated   = useBuilderStore((s) => s.setLastGenerated)

  const hasCore = Boolean(currentParts.cpu && currentParts.gpu)
  const profile = BUILD_PROFILES[useCase]

  function selectPart(part) { setCurrentParts((p) => ({ ...p, [part.category]: part })); setPickerCategory(null) }
  function deselect(category) { setCurrentParts((p) => { const n = { ...p }; delete n[category]; return n }) }
  function loadSaved(b) {
    const d = decodeBuild(b.code)
    if (!d) return
    setSavedSelectedId(b.id)
    setCurrentParts(d.parts)
  }
  function openInBuild() {
    setStoreUseCase(useCase)
    enterBuildTab()
    setBuild(currentParts)
    setStoreResolution(profile.resolution)
    const spend = totalOf(currentParts)
    setLastGenerated({ upgrade: true, useCase, spend, budget: spend })
    setBudget(spend) // flips App → BuilderScreen on the Build tab
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center text-ink bg-ground py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="rise font-display text-3xl font-extrabold mb-1 text-center">Upgrade your PC</h1>
        <ol className="rise flex items-center justify-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {['Current PC', 'Use case'].map((label, i) => {
            const active = (screen === 'specs' && i === 0) || (screen === 'usecase' && i === 1)
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span className="text-line-strong">→</span>}
                <span className={active ? 'text-accent' : 'text-faint'}>{i + 1} {label}</span>
              </li>
            )
          })}
        </ol>

        {screen === 'specs' && (
          <div className={`${PANEL} p-5 rise`}>
            <div className="inline-flex rounded-lg border border-line p-1 gap-0.5 mb-4">
              <button onClick={() => setTab('build')} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${tab === 'build' ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'}`}>Build current PC</button>
              <button onClick={() => setTab('saved')} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${tab === 'saved' ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'}`}>Select saved build</button>
            </div>

            {tab === 'build' ? (
              <CategoryList selectedParts={currentParts} onSelectCategory={setPickerCategory} onDeselect={deselect} />
            ) : saved.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">No saved builds yet. Build one first, or use the "Build current PC" tab.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-faint">Pick one of your saved builds to rate and upgrade.</p>
                {saved.map((b) => {
                  const on = savedSelectedId === b.id
                  const d = decodeBuild(b.code)
                  const total = d ? Object.values(d.parts).reduce((s, p) => s + (p?.price ?? 0), 0) : 0
                  return (
                    <button
                      key={b.id}
                      onClick={() => loadSaved(b)}
                      aria-pressed={on}
                      className={`w-full text-left border rounded-lg px-3 py-2.5 transition-colors
                        ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink">{b.name}</span>
                        <span className={`${TELEMETRY} text-xs ${on ? 'text-accent' : 'text-muted'}`}>£{total.toFixed(0)}</span>
                      </div>
                      <div className="text-[11px] text-faint font-mono">{new Date(b.savedAt).toLocaleDateString()}</div>
                    </button>
                  )
                })}
              </div>
            )}

            <p className="text-[11px] text-faint mt-4">CPU and GPU are required — they drive the rating.</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setScreen('usecase')}
                disabled={!hasCore}
                className={`${BTN_PRIMARY} px-6 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Next: use case →
              </button>
              <button onClick={onBack} className="text-xs text-faint hover:text-ink transition-colors">← Back to menu</button>
            </div>
          </div>
        )}

        {screen === 'usecase' && (
          <div className={`${PANEL} p-5 rise`}>
            <p className="text-sm text-muted mb-4">What do you use this PC for? We'll rate it for that.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {USE_CASES.map((u) => {
                const on = useCase === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setUseCase(u.id)}
                    aria-pressed={on}
                    className={`px-4 py-3 rounded-xl border text-left transition-colors
                      ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent'}`}
                  >
                    <div className={`text-sm font-semibold ${on ? 'text-accent' : 'text-ink'}`}>{u.label}</div>
                    <div className="text-[11px] text-muted mt-0.5">{u.blurb}</div>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button onClick={openInBuild} className={`${BTN_PRIMARY} px-6 py-2 rounded-lg text-sm transition-colors`}>Open in Build →</button>
              <button onClick={() => setScreen('specs')} className="text-xs text-faint hover:text-ink transition-colors">← Current PC</button>
            </div>
          </div>
        )}
      </div>

      {pickerCategory && (
        <PartSelector category={pickerCategory} contextParts={currentParts} ignoreBudget onSelect={selectPart} onClose={() => setPickerCategory(null)} />
      )}
    </div>
  )
}
