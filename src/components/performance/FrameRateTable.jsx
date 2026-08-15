import { useState } from 'react'
import FrameRateRow from './FrameRateRow'
import {
  RESOLUTIONS, groupByGenre, sortGameRows,
} from '../../lib/perfEngine/gameRows'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

// Every column, in render order. `key` is what sortGameRows sorts on; the two
// leading columns and the trailing one are not resolutions, so they carry no
// entry in RESOLUTIONS and are laid out here instead.
const COLUMNS = [
  { key: 'name', label: 'Game', align: 'left' },
  { key: 'preset', label: 'Preset', align: 'left' },
  ...RESOLUTIONS.map((res) => ({ key: res, label: RES_LABEL[res], align: 'right', res })),
  { key: 'basis', label: 'Basis', align: 'right' },
]

// The results, as a table rather than 155 bordered cards.
//
// A real <table> on purpose: three numeric columns per row is precisely the
// shape a screen reader needs <th scope="col"> for, and a grid of divs gives it
// nothing to announce.
export default function FrameRateTable({ rows, target, uncovered, onSelect }) {
  const [openGameId, setOpenGameId] = useState(null)
  // Genres start SHUT. Fifty-six rows is a wall even as a table; the tab opens
  // as six bars and a reader digs into the kind of game they care about.
  const [openGenres, setOpenGenres] = useState(() => new Set())
  const [sort, setSort] = useState(null)

  const groups = groupByGenre(rows, { target })

  const toggleGenre = (genre) => setOpenGenres((open) => {
    // Independent, not an accordion: comparing a shooter against an RPG is a
    // normal thing to want, and closing one to open the other prevents it.
    const next = new Set(open)
    if (next.has(genre)) next.delete(genre)
    else next.add(genre)
    return next
  })

  const clickHeader = (key) => setSort((s) => (
    // First click on a column sorts it the useful way round — fastest first
    // for a frame rate, A to Z for a name. Clicking the same one again flips.
    s?.key === key
      ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' }
      : { key, dir: key === 'name' ? 'asc' : 'desc' }
  ))

  // ⚠️ The column tint does NOT follow the pointer. A hover highlight that slid
  // between columns was tried and removed — the user's words were "just ugly".
  // The tint marks the build's target column and stays put.
  return (
    <>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            {COLUMNS.map(({ key, label, align, res }) => {
              const sorted = sort?.key === key
              return (
                <th
                  key={key}
                  scope="col"
                  // aria-current marks the BUILD's resolution, aria-sort marks
                  // what the table is ordered by. Two different claims, and
                  // colour alone must not carry either.
                  aria-current={res && res === target ? 'true' : undefined}
                  aria-sort={sorted ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  className={`px-2 py-1.5 font-normal ${align === 'right' ? 'text-right' : ''} ${
                    res && res !== target ? 'hidden sm:table-cell' : ''} ${
                    res === target ? 'bg-surface-2 text-ink' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => clickHeader(key)}
                    aria-label={`Sort by ${label}`}
                    className="uppercase tracking-wider hover:text-ink"
                  >
                    {label}
                    <span aria-hidden="true" className={sorted ? 'ml-1 text-ink' : 'ml-1 text-faint'}>
                      {sorted ? (sort.dir === 'desc' ? '↓' : '↑') : '↕'}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>

        {groups.map((group) => {
          const isOpen = openGenres.has(group.genre)
          return (
            // One tbody per genre, so the bar and its games are one group to a
            // screen reader rather than a flat run of rows.
            <tbody key={group.genre}>
              <tr className="border-b border-line bg-surface">
                <td colSpan={COLUMNS.length} className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleGenre(group.genre)}
                    aria-expanded={isOpen}
                    className="flex w-full items-baseline gap-2 text-left text-xs text-ink"
                  >
                    <span aria-hidden="true" className="text-[10px] text-muted">{isOpen ? '⌄' : '›'}</span>
                    <span>{group.label}</span>
                    {/* A shut bar is all a reader has to go on, so it carries
                        enough to decide whether opening it is worth it. */}
                    <span className="text-[11px] text-muted">
                      {group.count} game{group.count === 1 ? '' : 's'}
                      {group.fastest != null && (
                        group.fastest === group.slowest
                          ? ` · ${group.fastest} fps`
                          : ` · ${group.slowest}–${group.fastest} fps`
                      )}
                    </span>
                  </button>
                </td>
              </tr>

              {isOpen && sortGameRows(group.games, sort).map((g) => (
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
          )
        })}
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
