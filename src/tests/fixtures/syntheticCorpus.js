// A corpus with KNOWN ground truth, so the fitter can be checked against an
// answer rather than against itself. Deterministic — a flaky numerical test is
// worse than none, because it teaches people to re-run until it passes.

// Linear congruential generator. Not good randomness; perfectly good
// reproducibility, which is the only property that matters here.
export function makeRng(seed = 7) {
  let s = seed
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
}

export const TRUE_INDEX = { a: 100, b: 74.5, c: 51.2, d: 33.8, e: 22.1 }
export const TRUE_CELL = { g1: 420, g2: 610, g3: 285, g4: 950 }

// dropRate simulates a hand-curated corpus: nobody benchmarks every card in
// every game, so the matrix is sparse and unbalanced.
export function makeObservations({ dropRate = 0, noise = 0, seed = 7 } = {}) {
  const rnd = makeRng(seed)
  const obs = []
  for (const [partKey, index] of Object.entries(TRUE_INDEX)) {
    for (const [cellKey, cellConst] of Object.entries(TRUE_CELL)) {
      if (rnd() < dropRate) continue
      const jitter = 1 + (rnd() - 0.5) * noise
      obs.push({ cellKey, partKey, logT: Math.log((cellConst / index) * jitter), weight: 1 })
    }
  }
  return obs
}
