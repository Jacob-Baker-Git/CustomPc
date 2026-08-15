import { useState } from 'react'
import FrameRateRow from './FrameRateRow'
import { RESOLUTIONS } from '../../lib/perfEngine/gameRows'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

// The results, as a table rather than 155 bordered cards.
//
// A real <table> on purpose: three numeric columns per row is precisely the
// shape a screen reader needs <th scope="col"> for, and a grid of divs gives it
// nothing to announce.
export default function FrameRateTable({ rows, target, uncovered, onTargetChange, onSelect }) {
  // The table owns which row is open, so opening one closes the last. Two
  // expansions at once push the row a reader was comparing against off screen.
  const [openGameId, setOpenGameId] = useState(null)

  return (
    <>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th scope="col" className="py-1.5 pl-2 font-normal">Game</th>
            <th scope="col" className="px-2 py-1.5 font-normal">Preset</th>
            {RESOLUTIONS.map((res) => (
              <th
                key={res}
                scope="col"
                aria-current={res === target ? 'true' : undefined}
                className={`px-2 py-1.5 text-right font-normal ${
                  res === target ? 'bg-surface-2 text-ink' : 'hidden sm:table-cell'}`}
              >
                {/* The header doubles as the resolution picker. The tab had no
                    way to change resolution at all — setResolution was called
                    in exactly one place, at setup — so this is the control,
                    rather than adding a separate one beside three columns that
                    already name the choices.

                    aria-current carries the target as well as the colour does,
                    because colour alone must not carry it. */}
                <button
                  type="button"
                  onClick={() => onTargetChange?.(res)}
                  title={res === target ? 'This build’s resolution' : `Build for ${RES_LABEL[res]}`}
                  className={`uppercase tracking-wider underline decoration-dotted underline-offset-2 ${
                    res === target ? 'text-ink' : 'hover:text-ink'}`}
                >
                  {RES_LABEL[res]}
                </button>
              </th>
            ))}
            <th scope="col" className="px-2 py-1.5 text-right font-normal">Basis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <FrameRateRow
              key={g.gameId}
              game={g}
              target={target}
              expanded={openGameId === g.gameId}
              onToggle={(next) => setOpenGameId(next ? g.gameId : null)}
              onSelect={onSelect}
            />
          ))}
        </tbody>
      </table>

      {uncovered.length > 0 && (
        <section className="mt-3">
          {/* Named, not dropped. A game silently missing reads as a bug, and an
              honest statement of what the corpus does not cover is the point.
              The count comes off the list it heads so the two cannot drift. */}
          <h4 className="text-[11px] uppercase tracking-wider text-muted">
            No benchmark data yet — {uncovered.length} game{uncovered.length === 1 ? '' : 's'}
          </h4>
          <ul className="mt-1.5 grid gap-x-5 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
            {uncovered.map((u) => (
              <li key={u.gameId} className="text-xs sm:flex sm:items-baseline sm:justify-between sm:gap-2">
                <span className="text-muted">{u.name}</span>
                <span className="block text-[10px] uppercase tracking-wider text-faint sm:shrink-0">
                  {u.presets.join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
