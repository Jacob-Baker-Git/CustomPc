import { useState } from 'react'
import { BASIS_LABEL, CAVEAT_TEXT } from './basisText'
import { RESOLUTIONS, splitCell } from '../../lib/perfEngine/gameRows'
import { ELEV_ACTIVE, RAIL_ACTIVE } from '../../lib/uiTokens'
import GameArt from '../art/GameArt'
import { genreFor } from '../../lib/gameGenres'

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
//
// The build's target column is tinted down the whole table and the other two
// are dropped below `sm` — six columns do not fit 375px. FrameRateTable's
// headers carry the same two classes, or the columns would misalign.
//
// ⚠️ The tint does NOT follow the pointer. A hover highlight that slid between
// columns was built and removed — the user's words were "just ugly".
//
// ⚠️ No `/NN` opacity modifiers on these tokens. The palette resolves through
// `var(--surface-2)`, which holds a hex, so Tailwind cannot compose an alpha
// onto it and emits NO RULE AT ALL — `bg-surface-2/60` is a silently dead
// class, not a fainter tint. Use a whole token from the three-step scale.
// The build's target resolution is the figure the reader actually came for; the
// other two are context. So the target is set LARGER and in `ink` while the
// others drop to `muted` — the fill alone left all three reading at the same
// weight, which meant scanning three numbers to find the one that applied.
//
// Size tracks `isTarget` on the dash branch too, or a row whose target cell has
// no data would sit a little shorter than its neighbours.
function Cell({ row, isTarget }) {
  const col = isTarget ? 'bg-surface-2' : 'hidden sm:table-cell'
  const size = isTarget ? 'text-base' : 'text-sm'
  if (!row) {
    // A dash, never a zero. "0" reads as zero frames per second; this says
    // there is no data, which is a different statement. ~10% of the grid.
    return <td className={`px-2 py-1.5 text-right font-mono ${size} text-faint ${col}`}>—</td>
  }
  return (
    <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${size} ${
      isTarget ? 'text-ink' : 'text-muted'} ${col}`}
    >
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

  // The first cell that has an attribution. Most rows have none — a split needs
  // a fitted CPU constant, and only 2 of 56 rows carry one. Shared with the
  // bottleneck section below the table, which describes the same game and must
  // not reach a different answer about it.
  const split = splitCell(game)
  const splitLabel = !split ? null
    : split.limitedBy === 'cpu' ? 'processor-led'
      : split.limitedBy === 'gpu' ? 'graphics-led' : 'balanced'

  return (
    <>
      {/* `data-game` marks SUMMARY rows only. Expanding adds a second <tr>, so
          anything counting `tbody tr` would count expansions as games.

          ⚠️ The whole ROW toggles, not just the expander. The button inside it
          deliberately has NO onClick of its own — the click bubbles up to this
          handler. Giving it one too would toggle twice and the row would never
          open, which is invisible in review and pinned by a test. It stays a
          real <button> so keyboard and screen-reader users get a control with
          an accessible name and aria-expanded; Enter and Space there fire a
          click that bubbles the same way. */}
      <tr
        data-game={game.gameId}
        onClick={toggle}
        className="cursor-pointer border-b border-line hover:bg-surface"
      >
        {/* The rail marks the open row. Deliberately NOT a background step: the
            summary row's target cell is already surface-2, so tinting the whole
            row would swallow the column marker on exactly the row being read. */}
        <td className={`py-1.5 pl-2 ${isOpen ? RAIL_ACTIVE : ''}`}>
          <button
            type="button"
            aria-expanded={isOpen}
            className="flex items-center gap-1.5 text-left text-sm text-ink"
          >
            <span aria-hidden="true" className="text-[10px] text-muted">{isOpen ? '⌄' : '›'}</span>
            {/* Sixty rows of plain text is the table people scroll past. The
                plate gives each row something the eye can recognise on the way
                back up, which is what a cover does in any games list. */}
            <GameArt name={game.name} genre={genreFor(game)} seed={game.gameId} className="w-6 h-6 shrink-0" />
            {game.name}
          </button>
        </td>
        <td className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted">{game.preset}</td>
        {RESOLUTIONS.map((res) => (
          <Cell key={res} row={game.cells[res]} isTarget={res === target} />
        ))}
        <td className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider">
          <span className={game.basis === 'measured' ? 'text-good' : 'text-muted'}>
            {BASIS_LABEL[game.basis] ?? game.basis}
            {game.errorPct != null && ` ±${Math.round(game.errorPct)}%`}
          </span>
        </td>
      </tr>

      {isOpen && (
        <tr className={`border-b border-line ${ELEV_ACTIVE}`}>
          <td colSpan={3 + RESOLUTIONS.length} className={`px-2 pb-3 pt-1 ${RAIL_ACTIVE}`}>
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
                      ? `${Math.round((1 - split.cpuShare) * 100)}% graphics, ${splitLabel}`
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
