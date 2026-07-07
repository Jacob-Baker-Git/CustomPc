import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import Backdrop from './Backdrop'
import CategoryList from './CategoryList'
import PartSelector from './PartSelector'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { decodeBuild } from '../lib/buildCodec'
import { rateBuild, partUpgradeOptions } from '../lib/partRatings'
import { BUILD_PROFILES, USE_CASES, USE_CASE_LABEL } from '../lib/buildProfiles'
import { enterBuildTab } from '../lib/enterBuildTab'
import { PANEL, BTN_PRIMARY, TELEMETRY } from '../lib/uiTokens'

const CAT_LABEL = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage', psu: 'PSU',
  cooler: 'Cooler', motherboard: 'Motherboard', case: 'Case', fans: 'Fans',
}
const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)
const scoreText = (s) => (s >= 80 ? 'text-emerald-300' : s >= 50 ? 'text-amber-300' : 'text-red-400')
const scoreBar  = (s) => (s >= 80 ? 'bg-emerald-400' : s >= 50 ? 'bg-amber-400' : 'bg-red-500')

export default function UpgradeWizard({ onBack }) {
  const [screen, setScreen] = useState('specs')      // 'specs' | 'usecase' | 'dashboard'
  const [tab, setTab] = useState('build')
  const [currentParts, setCurrentParts] = useState({})
  const [savedSelectedId, setSavedSelectedId] = useState(null)
  const [pickerCategory, setPickerCategory] = useState(null)
  const [useCase, setUseCase] = useState('gaming')
  const [openCat, setOpenCat] = useState(null)

  const saved     = useSavedStore((s) => s.saved)
  const partsData = useCatalogStore((s) => s.parts)
  const gamesData = useCatalogStore((s) => s.games)
  const setBuild           = useBuilderStore((s) => s.setBuild)
  const setBudget          = useBuilderStore((s) => s.setBudget)
  const setStoreResolution = useBuilderStore((s) => s.setResolution)
  const setLastGenerated   = useBuilderStore((s) => s.setLastGenerated)

  const hasCore = Boolean(currentParts.cpu && currentParts.gpu)
  const profile = BUILD_PROFILES[useCase]
  const game = gamesData.find((g) => g.id === 'fortnite') ?? gamesData[0] ?? null

  const rating = useMemo(
    () => (screen === 'dashboard' && hasCore ? rateBuild(currentParts, useCase, partsData) : null),
    [screen, hasCore, currentParts, useCase, partsData],
  )
  const rows = rating ? Object.entries(rating.parts).sort((a, b) => a[1].score - b[1].score) : []

  function selectPart(part) { setCurrentParts((p) => ({ ...p, [part.category]: part })); setPickerCategory(null) }
  function deselect(category) { setCurrentParts((p) => { const n = { ...p }; delete n[category]; return n }) }
  function loadSaved(b) {
    const d = decodeBuild(b.code)
    if (!d) return
    setSavedSelectedId(b.id)
    setCurrentParts(d.parts)
  }
  function applyOption(category, toPart) {
    setCurrentParts((p) => ({ ...p, [category]: toPart }))
  }
  function openInBuild() {
    enterBuildTab()
    setBuild(currentParts)
    setStoreResolution(profile.resolution)
    const spend = totalOf(currentParts)
    setLastGenerated({ upgrade: true, useCase, spend, budget: spend })
    setBudget(spend) // flips App → BuilderScreen on the Build tab
  }

  const totalCurrent = totalOf(currentParts)

  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="rise text-3xl font-bold mb-1 text-center">Upgrade your PC</h1>
        <ol className="rise flex items-center justify-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
          {['Current PC', 'Use case', 'Ratings'].map((label, i) => {
            const active = (screen === 'specs' && i === 0) || (screen === 'usecase' && i === 1) || (screen === 'dashboard' && i === 2)
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span className="text-slate-700">→</span>}
                <span className={active ? 'text-cyan-300' : 'text-slate-500'}>{i + 1} {label}</span>
              </li>
            )
          })}
        </ol>

        {screen === 'specs' && (
          <div className={`${PANEL} p-5 rise`}>
            <div className="inline-flex rounded-sm border border-slate-800/60 p-0.5 mb-4">
              <button onClick={() => setTab('build')} className={`px-3 py-1 text-xs rounded-sm ${tab === 'build' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Build current PC</button>
              <button onClick={() => setTab('saved')} className={`px-3 py-1 text-xs rounded-sm ${tab === 'saved' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Select saved build</button>
            </div>

            {tab === 'build' ? (
              <CategoryList selectedParts={currentParts} onSelectCategory={setPickerCategory} onDeselect={deselect} />
            ) : saved.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet. Build one first, or use the "Build current PC" tab.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500">Pick one of your saved builds to rate and upgrade.</p>
                {saved.map((b) => {
                  const on = savedSelectedId === b.id
                  const d = decodeBuild(b.code)
                  const total = d ? Object.values(d.parts).reduce((s, p) => s + (p?.price ?? 0), 0) : 0
                  return (
                    <button
                      key={b.id}
                      onClick={() => loadSaved(b)}
                      aria-pressed={on}
                      className={`w-full text-left border rounded-sm px-3 py-2.5 transition-colors
                        ${on ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700/70 hover:border-slate-500'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-100">{b.name}</span>
                        <span className={`${TELEMETRY} text-xs ${on ? 'text-cyan-300' : 'text-slate-400'}`}>£{total.toFixed(0)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</div>
                    </button>
                  )
                })}
              </div>
            )}

            <p className="text-[11px] text-slate-500 mt-4">CPU and GPU are required — they drive the rating.</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setScreen('usecase')}
                disabled={!hasCore}
                className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                Next: use case →
              </button>
              <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to menu</button>
            </div>
          </div>
        )}

        {screen === 'usecase' && (
          <div className={`${PANEL} p-5 rise`}>
            <p className="text-sm text-slate-300 mb-4">What do you use this PC for? We'll rate it for that.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {USE_CASES.map((u) => {
                const on = useCase === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setUseCase(u.id)}
                    aria-pressed={on}
                    className={`px-4 py-3 rounded-sm border text-left transition-colors
                      ${on ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700/70 hover:border-cyan-400'}`}
                  >
                    <div className={`text-sm font-semibold ${on ? 'text-cyan-200' : 'text-slate-100'}`}>{u.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{u.blurb}</div>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button onClick={() => { setOpenCat(null); setScreen('dashboard') }} className={`${BTN_PRIMARY} px-6 py-2 rounded-sm text-sm font-medium transition-colors`}>See ratings →</button>
              <button onClick={() => setScreen('specs')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Current PC</button>
            </div>
          </div>
        )}

        {screen === 'dashboard' && rating && (
          <div className={`${PANEL} p-5 rise`}>
            <div className="flex items-center gap-4 mb-5">
              <div className={`${TELEMETRY} text-4xl font-bold ${scoreText(rating.overall)}`}>{rating.overall}<span className="text-lg text-slate-500">/100</span></div>
              <div>
                <div className="text-sm text-white">{rating.verdict}</div>
                <div className="text-[11px] text-slate-500">Tap a part to see upgrades that raise its score.</div>
              </div>
            </div>

            <div className="space-y-1.5">
              {rows.map(([cat, info]) => (
                <div key={cat} className="border border-slate-800/60 rounded-sm">
                  <button onClick={() => setOpenCat(openCat === cat ? null : cat)} className="w-full px-3 py-2 text-left">
                    <div className="flex items-center gap-3">
                      <span className="uppercase text-[10px] text-slate-500 w-16 shrink-0">{CAT_LABEL[cat] ?? cat}</span>
                      <span className="text-sm text-slate-100 flex-1 min-w-0 truncate">{info.part.name}</span>
                      <span className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                        <span className={`block h-full ${scoreBar(info.score)}`} style={{ width: `${info.score}%` }} />
                      </span>
                      <span className={`${TELEMETRY} text-sm font-semibold w-8 text-right shrink-0 ${scoreText(info.score)}`}>{info.score}</span>
                      <ChevronDown size={14} className={`text-slate-500 transition-transform shrink-0 ${openCat === cat ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </div>
                    {info.reason && <span className="block text-[11px] text-amber-300/80 mt-1 pl-[4.75rem]">{info.reason}</span>}
                  </button>

                  {openCat === cat && (
                    <div className="border-t border-slate-800/60 p-2 space-y-2">
                      {(() => {
                        const opts = partUpgradeOptions(currentParts, useCase, cat, partsData, { game })
                        if (opts.length === 0) return <p className="text-xs text-slate-400 px-1 py-1">Your {CAT_LABEL[cat] ?? cat} is already well-matched for {USE_CASE_LABEL[useCase]}.</p>
                        return opts.map((o) => (
                          <div key={o.toPart.id} className="flex items-center gap-2 border border-slate-700/70 rounded-sm px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-100 truncate">{o.toPart.name}</div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="text-emerald-300">→ {o.newScore}/100</span>
                                <span>+£{o.extraCost.toFixed(0)}</span>
                                {o.fpsGain != null && o.fpsGain > 0 && <span className="text-cyan-300">+{o.fpsGain} fps</span>}
                              </div>
                            </div>
                            <button onClick={() => applyOption(cat, o.toPart)} className={`${BTN_PRIMARY} text-xs font-medium px-3 py-1.5 rounded-sm shrink-0 transition-colors`}>Apply</button>
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 mt-5">
              <button onClick={() => setScreen('usecase')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Use case</button>
              <div className="flex items-center gap-3">
                <span className={`${TELEMETRY} text-xs text-slate-400`}>£{totalCurrent.toFixed(0)}</span>
                <button onClick={openInBuild} className={`${BTN_PRIMARY} px-5 py-2 rounded-sm text-sm font-medium transition-colors`}>Open in Build tab →</button>
              </div>
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
