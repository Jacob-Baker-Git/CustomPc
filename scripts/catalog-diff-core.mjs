// Pure comparison between the catalogue committed in this repo and the one the
// live site actually serves.
//
// ⚠️ WHY THIS EXISTS. src/data/partsData.json is NOT what users see. App.jsx
// calls loadCatalog() on mount, which fetches parts/peripherals/games from
// Supabase and swaps them in over the bundled snapshot. Nothing kept the two in
// step and nothing noticed when they diverged, so a correction committed here
// could reach nobody — which is exactly what happened to the RTX 4090's length.
//
// This module is pure and network-free so it can be tested; the CLI wrappers
// do the fetching.

// Identity is the id, NEVER the array index. Supabase returns `order=id` while
// the bundled JSON keeps its own authored order, and the two disagree for
// essentially every row. A positional comparison would report the entire
// catalogue as drifted on every run.
const byId = (rows) => new Map(rows.map((r) => [r.id, r]))

// Key order is not meaning: a row round-trips through jsonb, which does not
// preserve it. Sorting keys at every level makes the comparison structural.
function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]))
  }
  return value
}

const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))

// Which top-level fields differ. `specs` is compared whole rather than walked,
// because "specs changed" is the actionable unit — the CLI prints both sides.
function changedFields(local, remote) {
  const keys = [...new Set([...Object.keys(local), ...Object.keys(remote)])].sort()
  return keys.filter((k) => !same(local[k], remote[k]))
}

export function diffTable(local, remote) {
  const l = byId(local)
  const r = byId(remote)
  const missing = []   // in the repo, not live
  const extra = []     // live, not in the repo
  const changed = []

  for (const [id, row] of l) {
    const other = r.get(id)
    if (!other) { missing.push(id); continue }
    const fields = changedFields(row, other)
    if (fields.length > 0) changed.push({ id, fields, local: row, remote: other })
  }
  for (const id of r.keys()) if (!l.has(id)) extra.push(id)

  return { missing, extra, changed }
}

export function summarise(diff) {
  const count = diff.missing.length + diff.extra.length + diff.changed.length
  return { drifted: count > 0, count }
}
