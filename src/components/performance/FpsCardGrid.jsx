import FpsCard from './FpsCard'

// Covered games get a card each; uncovered ones get a name in a dense list.
//
// They used to be identical cards, so 22 rows of "No benchmark data yet"
// outweighed the one game that actually had an answer and pushed it off the
// top of the screen — the page shouted loudest about what it did not know.
//
// The uncovered games are NOT dropped. A game silently missing from the list
// reads as a bug, and the honest statement of coverage is the point. They are
// just quieter than the result: same information, a tenth of the space.
export default function FpsCardGrid({ rows }) {
  // The engine already orders covered first, then by game, then by preset;
  // partitioning keeps that order within each group rather than imposing a
  // second sort.
  const covered = rows.filter((r) => r.basis !== 'none')

  // Uncovered rows are collapsed to ONE LINE PER GAME. The engine reports a row
  // per game and preset, so a game nobody has benchmarked at any setting would
  // otherwise appear four times in a row saying nothing four times over — the
  // exact noise this list was split out to avoid. The presets are still named,
  // because which settings are missing is part of the gap being disclosed.
  const uncoveredByGame = []
  const seen = new Map()
  for (const row of rows) {
    if (row.basis !== 'none') continue
    // A game with SOME answered preset is not uncovered; its remaining presets
    // are already visible as cards beside the ones that answered.
    if (covered.some((c) => c.gameId === row.gameId)) continue
    if (!seen.has(row.gameId)) {
      const entry = { gameId: row.gameId, name: row.name, presets: [] }
      seen.set(row.gameId, entry)
      uncoveredByGame.push(entry)
    }
    seen.get(row.gameId).presets.push(row.preset)
  }

  return (
    <>
      {covered.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {covered.map((row) => <FpsCard key={row.rowId} row={row} />)}
        </div>
      )}

      {uncoveredByGame.length > 0 && (
        <section className={`rounded-lg border border-line bg-surface p-3 ${covered.length ? 'mt-2.5' : ''}`}>
          <h4 className="text-[11px] uppercase tracking-wider text-muted">
            No benchmark data yet — {uncoveredByGame.length} of {seenGames(rows)} games
          </h4>
          <ul className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
            {uncoveredByGame.map((row) => (
              // Stacked on mobile, opposed on wider screens. Side by side at
              // 375px, a long preset name ("Grafik priorisieren, maximale
              // Qualität") squeezes the game title until it wraps mid-word.
              // Truncating the preset instead would hide data the page is
              // meant to list.
              <li key={row.gameId}
                  className="text-xs sm:flex sm:items-baseline sm:justify-between sm:gap-2">
                <span className="text-muted">{row.name}</span>
                <span className="block text-[10px] uppercase tracking-wider text-muted/70 sm:shrink-0">
                  {row.presets.join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// How many distinct games the report covered, as opposed to how many rows it
// returned. The heading compares like with like: N games with nothing against
// M games asked about, not against a row count that varies with how many
// presets each reviewer tested.
function seenGames(rows) {
  return new Set(rows.map((r) => r.gameId)).size
}
