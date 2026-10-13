import { useState } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import perfGames from '../data/perfGames.json'
import { findPreset, presetKey } from '../lib/gameTargetBuilder'
import { presetsFor } from '../lib/gamePresets'
import ResolutionPicker from './performance/ResolutionPicker'

export const gameById = (id) => perfGames.find((g) => g.id === id) ?? null

// A native <datalist>: the browser does the searching and the list, and a typed
// name only counts once it matches a game exactly — partial text selects nothing.
export default function GameSettingsFields() {
  const target = useBuilderStore((s) => s.target)
  const setTarget = useBuilderStore((s) => s.setTarget)
  const resolution = useBuilderStore((s) => s.resolution)
  const setResolution = useBuilderStore((s) => s.setResolution)
  const game = gameById(target.gameId)
  const [text, setText] = useState(game?.name ?? '')

  function onGameText(value) {
    setText(value)
    const match = perfGames.find((g) => g.name.toLowerCase() === value.trim().toLowerCase())
    if ((match?.id ?? null) !== target.gameId) setTarget({ gameId: match?.id ?? null, presetKey: null })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Game
        <input
          type="search" list="game-list" value={text} placeholder="Search games"
          onChange={(e) => onGameText(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink"
        />
        <datalist id="game-list">
          {perfGames.map((g) => <option key={g.id} value={g.name} />)}
        </datalist>
      </label>
      {game && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Graphics setting
          <select
            value={presetKey(findPreset(game, target.presetKey))}
            onChange={(e) => setTarget({ presetKey: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink"
          >
            {presetsFor(game).map((p) => <option key={presetKey(p)} value={presetKey(p)}>{p.label}</option>)}
          </select>
        </label>
      )}
      <ResolutionPicker value={resolution} onChange={setResolution} />
    </div>
  )
}
