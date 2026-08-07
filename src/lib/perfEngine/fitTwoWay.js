// Alternating least squares over a two-way additive model in log space.
//
// The model is multiplicative — observed frame time = cellConst / partIndex —
// and taking logs turns it into a row-effect plus column-effect decomposition:
//
//     log t = log cellConst - log partIndex
//
// which alternates to a solution in a handful of passes and stays well-behaved
// on a sparse, unbalanced matrix. That matters: hand curation produces a corpus
// where one GPU appears in eleven games and another in two.
//
// NO IMPORTS. scripts/fit-perf-model.mjs loads this under plain Node, which
// cannot resolve the extensionless imports used elsewhere in src/lib.

// Which parts are reachable from the anchor by walking part -> shared cell ->
// part. The decomposition determines index ratios only WITHIN a connected
// component: two components sharing no cell have no measurement relating them,
// so their relative scale is not in the data at all.
//
// This is not a hypothetical. It is what happens when two reviews share no
// hardware and no game. Alternating least squares does not fail on it — it
// converges happily and hands back a confident-looking cross-component ratio
// that is purely an artefact of both components starting from the same
// initialisation. A number nobody measured, presented exactly like one that was
// measured, is the single failure this engine exists to prevent, so the caller
// is told which parts it may trust.
function reachableFrom(anchorPartKey, byPart, byCell) {
  const parts = new Set([anchorPartKey])
  const cells = new Set()
  const queue = [anchorPartKey]
  while (queue.length > 0) {
    for (const o of byPart.get(queue.pop()) ?? []) {
      if (cells.has(o.cellKey)) continue
      cells.add(o.cellKey)
      for (const sibling of byCell.get(o.cellKey) ?? []) {
        if (!parts.has(sibling.partKey)) {
          parts.add(sibling.partKey)
          queue.push(sibling.partKey)
        }
      }
    }
  }
  return parts
}

function weightedMean(rows, valueOf) {
  let totalWeight = 0
  let total = 0
  for (const row of rows) {
    const w = row.weight ?? 1
    totalWeight += w
    total += w * valueOf(row)
  }
  return totalWeight > 0 ? total / totalWeight : 0
}

// observations: [{ cellKey, partKey, logT, weight? }]
// Returns { index, cellConst, anchorPartKey, iterations, converged }, the two
// maps holding LINEAR values (already exponentiated).
export function fitTwoWay(observations, {
  anchorPartKey, anchorValue = 100, tol = 1e-10, maxIter = 500,
} = {}) {
  const partKeys = [...new Set(observations.map((o) => o.partKey))]
  const cellKeys = [...new Set(observations.map((o) => o.cellKey))]
  if (partKeys.length === 0) {
    return { index: new Map(), cellConst: new Map(), anchorPartKey: null,
             iterations: 0, converged: true }
  }

  const byCell = new Map(cellKeys.map((k) => [k, []]))
  const byPart = new Map(partKeys.map((k) => [k, []]))
  for (const o of observations) {
    byCell.get(o.cellKey).push(o)
    byPart.get(o.partKey).push(o)
  }

  const logIndex = new Map(partKeys.map((k) => [k, 0]))
  const logCell = new Map(cellKeys.map((k) => [k, 0]))

  let iterations = 0
  let converged = false
  for (; iterations < maxIter; iterations++) {
    let delta = 0
    for (const c of cellKeys) {
      const next = weightedMean(byCell.get(c), (r) => r.logT + logIndex.get(r.partKey))
      delta = Math.max(delta, Math.abs(next - logCell.get(c)))
      logCell.set(c, next)
    }
    for (const p of partKeys) {
      const next = weightedMean(byPart.get(p), (r) => logCell.get(r.cellKey) - r.logT)
      delta = Math.max(delta, Math.abs(next - logIndex.get(p)))
      logIndex.set(p, next)
    }
    if (delta < tol) { converged = true; iterations += 1; break }
  }

  // Re-anchor. The decomposition is only determined up to a constant shift
  // between the two effects, so without this the indices drift run to run and
  // stop being comparable. Shifting both sides by the same amount leaves every
  // predicted frame time untouched.
  let anchor = anchorPartKey
  if (!logIndex.has(anchor)) {
    anchor = partKeys.reduce((best, k) =>
      (byPart.get(k).length > byPart.get(best).length ? k : best))
  }
  const shift = Math.log(anchorValue) - logIndex.get(anchor)
  for (const p of partKeys) logIndex.set(p, logIndex.get(p) + shift)
  for (const c of cellKeys) logCell.set(c, logCell.get(c) + shift)

  // Only the anchor's own component has a meaningful scale (see reachableFrom).
  // Everything else is reported so the caller can refuse to use it, rather than
  // silently quoting a number no measurement supports.
  const connected = reachableFrom(anchor, byPart, byCell)
  const disconnected = partKeys.filter((k) => !connected.has(k))

  return {
    index: new Map([...logIndex].map(([k, v]) => [k, Math.exp(v)])),
    cellConst: new Map([...logCell].map(([k, v]) => [k, Math.exp(v)])),
    anchorPartKey: anchor,
    iterations,
    converged,
    connected,
    disconnected,
  }
}
