import { useState } from 'react'
import { BASIS_LABEL, CAVEAT_TEXT } from './basisText'
import { RESOLUTIONS } from '../../lib/perfEngine/gameRows'

// One game: a summary row, and a detail row that opens beneath it.
//
// Replaces FpsCard, which drew a bordered box per game AND preset — 60 of them
// at 1440p and 155 at 1080p once every catalogue CPU started answering. The
// figures are unchanged; what changed is that a reader can now scan a column
// instead of a wall.

// One resolution's number.
//
// The ≤ marker is per CELL, driven by that cell's own `bound`. A game can be a
// ceiling at 4K and a point estimate at 1080p, so a single marker for the whole
// row would misdescribe one of them.
function Cell({ row, hidden }) {
  const hide = hidden ? 'hidden sm:table-cell' : ''
  if (!row) {
    // A dash, never a zero. "0" reads as zero frames per second; this says
    // there is no data, which is a different statement. ~10% of the grid.
    return <td className={`px-2 py-1.5 text-right font-mono text-sm text-faint ${hide}`}>—</td>
  }
  return (
    <td className={`px-2 py-1.5 text-right font-mono text-sm tabular-nums text-ink ${hide}`}>
      {row.bound === 'upper' && <span className="text-muted">≤</span>}
      {row.avgFps}
    </td>
  )
}

export default function FrameRateRow({ game, target, onSelect, expanded, onToggle }) {
  // Uncontrolled unless the parent passes both, so the component is usable in a
  // test without wiring selection state.
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = expanded ?? ownOpen

  const toggle = () => {
    const next = !isOpen
    if (onToggle) onToggle(next)
    else setOwnOpen(next)
    if (next) onSelect?.(game.gameId)
  }

  const shown = RESOLUTIONS.map((r) => game.cells[r]).filter(Boolean)
  // The first cell that has an attribution. Most rows have none — a split needs
  // a fitted CPU constant, and only a handful of cells carry one.
  const split = shown.find((r) => r.cpuShare != null && r.limitedBy != null)
  const splitLabel = !split ? null
    : split.limitedBy === 'cpu' ? 'processor-led'
      : split.limitedBy === 'gpu' ? 'graphics-led' : 'balanced'

  return (
    <>
      {/* `data-game` marks SUMMARY rows only. Expanding adds a second <tr>, so
          anything counting `tbody tr` would count expansions as games. */}
      <tr data-game={game.gameId} className="border-b border-line/60 hover:bg-surface-2/50">
        <td className="py-1.5 pl-2">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={isOpen}
            className="flex items-center gap-1.5 text-left text-sm text-ink"
          >
            <span aria-hidden="true" className="text-[10px] text-muted">{isOpen ? '⌄' : '›'}</span>
            {game.name}
          </button>
        </td>
        <td className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted">{game.preset}</td>
        {RESOLUTIONS.map((res) => (
          <Cell key={res} row={game.cells[res]} hidden={res !== target} />
        ))}
        <td className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider">
          <span className={game.basis === 'measured' ? 'text-good' : 'text-muted'}>
            {BASIS_LABEL[game.basis] ?? game.basis}
            {game.errorPct != null && ` ±${Math.round(game.errorPct)}%`}
          </span>
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-line/60 bg-surface-2/30">
          <td colSpan={3 + RESOLUTIONS.length} className="px-2 pb-3 pt-1">
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <dl className="text-[11px] text-muted">
                {/* Below `sm` the off-target columns are hidden, so their
                    averages live here instead of being lost. */}
                {RESOLUTIONS.filter((r) => r !== target && game.cells[r]).map((r) => (
                  <div key={`avg-${r}`} className="flex justify-between gap-3 py-0.5 sm:hidden">
                    <dt>Average at {r}</dt>
                    <dd className="font-mono text-ink">
                      {game.cells[r].bound === 'upper' ? '≤' : ''}{game.cells[r].avgFps}
                    </dd>
                  </div>
                ))}
                {RESOLUTIONS.filter((r) => game.cells[r]).map((r) => (
                  <div key={`low-${r}`} className="flex justify-between gap-3 py-0.5">
                    <dt>1% low at {r}</dt>
                    <dd className="font-mono text-ink">{game.cells[r].lowFps ?? '—'}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 py-0.5">
                  <dt>Split</dt>
                  {/* Stated in words, not drawn as a bar. `1 - null` is 1 in
                      JavaScript, so a bar drawn without a split shows a full
                      graphics bar labelled "balanced" — two contradictory
                      claims, neither of them measured. */}
                  <dd className="text-ink">
                    {split
                      ? `${Math.round((1 - split.cpuShare) * 100)}% graphics — ${splitLabel}`
                      : 'Split not modelled'}
                  </dd>
                </div>
              </dl>

              <div className="text-[11px] text-muted">
                {game.otherPresets.length > 0 && (
                  <p className="py-0.5">
                    <span className="text-ink">Also measured:</span>{' '}
                    {game.otherPresets.map((p) => p.preset).join(' · ')}
                  </p>
                )}
                <ul className="space-y-1">
                  {game.caveats.map((c) => (
                    <li key={c} className="leading-snug">{CAVEAT_TEXT[c] ?? c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
