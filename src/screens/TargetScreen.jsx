import { useState } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import perfModel from '../data/perfModel.json'
import { buildForGame, findPreset, gameById } from '../lib/gameTargetBuilder'
import GameSettingsFields from '../components/GameSettingsFields'
import { CATEGORIES } from '../lib/categories'
import { BTN_PRIMARY, PANEL, TELEMETRY } from '../lib/uiTokens'

const fpsText = (o) => `${o.bound === 'upper' ? 'up to ' : ''}${o.fps} fps`

function BuildOption({ title, option, onUse }) {
  return (
    <section className={`${PANEL} p-4`}>
      <h2 className="text-base text-ink">{title}</h2>
      <p className={`${TELEMETRY} text-2xl text-ink`}>{fpsText(option)} · £{option.total.toFixed(0)}</p>
      <ul className="mt-2 text-xs text-muted">
        {CATEGORIES.filter((c) => option.parts[c.id]).map((c) => (
          <li key={c.id}>{c.label}: {option.parts[c.id].name}</li>
        ))}
      </ul>
      <button onClick={onUse} className={`mt-3 ${BTN_PRIMARY} text-sm px-4 py-2 rounded-lg`}>Use this build</button>
    </section>
  )
}

export default function TargetScreen() {
  const target = useBuilderStore((s) => s.target)
  const setTarget = useBuilderStore((s) => s.setTarget)
  const storeBudget = useBuilderStore((s) => s.budget)
  const resolution = useBuilderStore((s) => s.resolution)
  const parts = useCatalogStore((s) => s.parts)
  const [fps, setFps] = useState(String(target.fps))
  const [budget, setBudgetText] = useState(String(storeBudget > 0 ? storeBudget : 1000))
  const [result, setResult] = useState(null)
  const game = gameById(target.gameId)
  const fpsNum = Number(fps)
  const budgetNum = Number(budget)
  const ready = Boolean(game) && fpsNum > 0 && budgetNum > 0

  function find() {
    setTarget({ fps: fpsNum })
    useBuilderStore.getState().setBudget(budgetNum)
    setResult({
      budget: budgetNum, fps: fpsNum, game,
      ...buildForGame({ game, preset: findPreset(game, target.presetKey), resolution,
                        targetFps: fpsNum, budget: budgetNum, parts, model: perfModel }),
    })
  }

  function use(option) {
    const s = useBuilderStore.getState()
    s.setBuild(option.parts)
    s.setPath('game')
    s.setFlow('builder', 'peripherals')
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Build for a game</h1>
      <GameSettingsFields />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Target FPS
          <input type="number" min="1" value={fps} onChange={(e) => setFps(e.target.value)}
                 className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Budget (£)
          <input type="number" min="1" value={budget} onChange={(e) => setBudgetText(e.target.value)}
                 className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink" />
        </label>
        <button onClick={find} disabled={!ready}
                className={`${BTN_PRIMARY} text-sm px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed`}>
          Find builds
        </button>
      </div>

      {result && (
        <div className="mt-6 flex flex-col gap-3">
          {result.noData ? (
            <p className="text-sm text-muted">No benchmark data for {result.game.name} at these settings yet, so there is nothing to build towards.</p>
          ) : (
            <>
              {result.best
                ? <BuildOption title={`Best build within £${result.budget}`} option={result.best} onUse={() => use(result.best)} />
                : <p className="text-sm text-muted">No complete build fits £{result.budget}.</p>}
              {result.cheapestHit && (
                <BuildOption title={`Cheapest build that hits ${result.fps} fps`} option={result.cheapestHit} onUse={() => use(result.cheapestHit)} />
              )}
              {result.unreachable && (
                <p className="text-sm text-muted">
                  No build in the catalogue reaches {result.fps} fps in {result.game.name} at these settings.
                  The fastest manages {fpsText(result.fastest)} for £{result.fastest.total.toFixed(0)}.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
