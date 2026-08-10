// How lopsided the benchmark corpus is, by review and by OUTLET.
//
// Measuring, not gating. Measurements for an individual part are genuinely hard
// to find, so the corpus takes any valid data now and gets diluted later; a build
// that refuses to run because the data it has is unevenly sourced helps nobody —
// it just keeps 216 real measurements out of the UI. What matters is that the
// imbalance stays VISIBLE, in the artefact, so "dilute later" is driven by a
// number rather than by somebody remembering.
//
// Grouped by outlet as well as by review because that is what the concern is
// actually about. The check this replaces was per review while appealing to not
// taking one outlet's compilation, so two articles from the same outlet counted
// as two independent sources and ComputerBase's real 80% of the corpus presented
// itself as 74%.
//
// Zero imports on purpose: scripts/fit-perf-model.mjs runs under plain Node,
// which cannot resolve this project's extensionless relative imports.

const UNKNOWN_OUTLET = 'unknown'

export function concentration(entries = [], sources = []) {
  // Superseded entries are excluded, matching what the fit itself consumes — a
  // share measured over rows the model never sees would describe nothing.
  const live = entries.filter((e) => !e.supersededBy)
  const total = live.length

  const outletOf = new Map(sources.map((s) => [s.id, s.outlet ?? UNKNOWN_OUTLET]))

  const perSource = new Map()
  const perOutlet = new Map()
  for (const e of live) {
    perSource.set(e.sourceId, (perSource.get(e.sourceId) ?? 0) + 1)
    // An entry whose sourceId is not in sources.json is an error worth catching
    // elsewhere, but it is counted here regardless: dropping it would understate
    // the very imbalance this measures.
    const outlet = outletOf.get(e.sourceId) ?? UNKNOWN_OUTLET
    if (!perOutlet.has(outlet)) perOutlet.set(outlet, { entries: 0, sources: new Set() })
    const o = perOutlet.get(outlet)
    o.entries += 1
    o.sources.add(e.sourceId)
  }

  const share = (n) => (total > 0 ? n / total : 0)
  const heaviestFirst = (a, b) => b.entries - a.entries || String(a.id ?? a.outlet).localeCompare(String(b.id ?? b.outlet))

  const bySource = [...perSource].map(([id, n]) => ({
    id,
    outlet: outletOf.get(id) ?? UNKNOWN_OUTLET,
    entries: n,
    share: share(n),
  })).sort(heaviestFirst)

  const byOutlet = [...perOutlet].map(([outlet, o]) => ({
    outlet,
    entries: o.entries,
    share: share(o.entries),
    sources: [...o.sources].sort(),
  })).sort(heaviestFirst)

  return {
    total,
    bySource,
    byOutlet,
    // The single figure worth watching, and the name of the thing to dilute.
    topOutlet: byOutlet[0]?.outlet ?? null,
    topOutletShare: byOutlet[0]?.share ?? null,
  }
}
