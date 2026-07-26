import { useState } from 'react'
import Backdrop from './Backdrop'
import useBuilderStore from '../store/useBuilderStore'
import { TIERS } from '../lib/tiers'
import { BUILD_PROFILES, USE_CASES } from '../lib/buildProfiles'
import { buildForUseCase } from '../lib/useCaseBuilder'
import useCatalogStore from '../store/useCatalogStore'
import { enterBuildTab } from '../lib/enterBuildTab'

const STEPS = ['Budget', 'Use case']
const totalOf = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

export default function BudgetEntry({ onSubmit, onBack }) {
  const [step, setStep] = useState(1)
  const [value, setValue] = useState('')
  const [useCase, setUseCase] = useState('gaming')
  const setResolution = useBuilderStore((s) => s.setResolution)
  const setBuild = useBuilderStore((s) => s.setBuild)
  const clearBuild = useBuilderStore((s) => s.clearBuild)
  const setLastGenerated = useBuilderStore((s) => s.setLastGenerated)
  const setStoreUseCase = useBuilderStore((s) => s.setUseCase)
  const partsData = useCatalogStore((s) => s.parts)

  const budgetNum = parseFloat(value)

  function handleBudgetSubmit(e) {
    e.preventDefault()
    if (budgetNum > 0) setStep(2)
  }

  function generate() {
    const profile = BUILD_PROFILES[useCase]
    const parts = buildForUseCase(budgetNum, useCase, partsData)
    enterBuildTab()
    setResolution(profile.resolution)
    setBuild(parts)
    setStoreUseCase(useCase)
    setLastGenerated({ useCase, spend: totalOf(parts), budget: budgetNum })
    onSubmit(budgetNum)
  }

  // Really start with nothing — also drops any build persisted from a previous
  // visit, which used to leak into "empty" sessions.
  function startEmpty() {
    enterBuildTab()
    clearBuild()
    setStoreUseCase(useCase)
    setResolution(BUILD_PROFILES[useCase].resolution)
    onSubmit(budgetNum)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center text-ink bg-ground">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center px-4">
        <h1 className="rise font-display text-5xl font-extrabold mb-3 text-ink tracking-tight">Build Your PC</h1>
        <ol className="rise flex items-center gap-2 mb-6 text-[11px] uppercase tracking-wider">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-line-strong">→</span>}
              <span className={`flex items-center gap-1.5 ${step === i + 1 ? 'text-accent' : 'text-faint'}`}>
                <span className="font-mono">{i + 1}</span>
                <span>{label}</span>
              </span>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <>
            <p className="rise text-muted mb-10 text-lg">What's your budget?</p>
            <form onSubmit={handleBudgetSubmit} aria-label="form" className="rise rise-2 flex flex-col items-center gap-6">
              <div className="flex items-center gap-2 text-3xl">
                <span className="text-accent">£</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  placeholder="Enter budget"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="bg-surface text-ink font-mono tabular-nums text-3xl w-72 px-4 py-3 rounded-xl border border-line focus:outline-none focus:border-accent text-center placeholder:text-2xl placeholder:text-faint transition-colors"
                />
              </div>
              <button type="submit" className="bg-accent hover:brightness-110 text-accent-ink font-semibold px-10 py-3 rounded-lg text-lg transition-colors">
                Next: use case
              </button>
            </form>
            <div className="rise rise-3 mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-faint">or start from a preset:</span>
              {TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => { setValue(String(tier.budget)); setStep(2) }}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border border-line bg-surface text-ink hover:border-accent hover:text-accent transition-colors"
                >
                  {tier.label} · £{tier.budget}
                </button>
              ))}
            </div>
            <button onClick={onBack} className="rise rise-4 mt-8 text-xs text-faint hover:text-ink transition-colors">← Back to menu</button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="rise text-muted mb-10 text-lg">What will you use this PC for?</p>
            <div className="rise rise-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {USE_CASES.map((u) => {
                const selected = useCase === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setUseCase(u.id)}
                    aria-pressed={selected}
                    className={`w-64 px-4 py-5 rounded-xl border text-left transition-colors group
                      ${selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent'}`}
                  >
                    <div className={`text-xl font-bold ${selected ? 'text-accent' : 'text-ink group-hover:text-accent'}`}>{u.label}</div>
                    <div className={`text-xs mt-1 ${selected ? 'text-accent' : 'text-muted'}`}>{u.blurb}</div>
                  </button>
                )
              })}
            </div>
            <div className="rise rise-3 flex gap-3 mt-8">
              <button onClick={generate} className="bg-accent hover:brightness-110 text-accent-ink font-semibold px-8 py-3 rounded-lg transition-colors">
                Generate build
              </button>
              <button onClick={startEmpty} className="px-8 py-3 rounded-lg border border-line text-muted hover:border-line-strong hover:text-ink transition-colors">
                Start empty instead
              </button>
            </div>
            <button onClick={() => setStep(1)} className="rise rise-4 mt-6 text-xs text-faint hover:text-ink transition-colors">← Back to budget</button>
          </>
        )}
      </div>
    </div>
  )
}
