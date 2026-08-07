// Build-level bottleneck analysis, derived from the per-game frame split.
//
// Deliberately NOT the same thing as src/lib/bottleneck.js. That one compares
// two invented perfScores and still drives the CustomPC score; this one is
// built on measured frame times, and reports per game rather than once for the
// whole build — because the answer genuinely differs per game. A CPU that
// holds back CS2 can be completely irrelevant in Cyberpunk, and one verdict
// for the whole library hides exactly the information a buyer needs.

// A mildly GPU-led build is the healthy normal state, not a fault: the card
// SHOULD be the limiter at sensible resolutions. Only a real imbalance is
// worth naming, which is why the balanced band is wide.
const WASTED_GPU_BELOW = 0.75   // cpu-only fps this far under gpu-only = waste

export function bottleneckSummary(rows) {
  const usable = rows.filter((r) => r.cpuShare != null && r.gpuOnlyFps && r.cpuOnlyFps)
  if (usable.length === 0) return null

  const cpuLed = usable.filter((r) => r.limitedBy === 'cpu')
  const gpuLed = usable.filter((r) => r.limitedBy === 'gpu')
  const balanced = usable.filter((r) => r.limitedBy === 'balanced')
  const meanShare = usable.reduce((s, r) => s + r.cpuShare, 0) / usable.length

  // Where is the most frame rate actually being left on the table? Measured as
  // the ratio between what the weaker side delivers and what the stronger one
  // could, averaged over the games — not as a single headline percentage,
  // which flatters a build that is fine in most titles and terrible in one.
  const worst = usable.reduce((a, b) => (ratio(a) < ratio(b) ? a : b))

  const leaning = meanShare > 0.62 ? 'cpu' : meanShare < 0.38 ? 'gpu' : 'balanced'

  return {
    leaning,
    meanCpuShare: Number(meanShare.toFixed(3)),
    cpuLedGames: cpuLed.length,
    gpuLedGames: gpuLed.length,
    balancedGames: balanced.length,
    gamesConsidered: usable.length,
    worstCase: {
      gameId: worst.gameId,
      name: worst.name,
      gpuOnlyFps: worst.gpuOnlyFps,
      cpuOnlyFps: worst.cpuOnlyFps,
      lostToWeakerSide: Math.round((1 - ratio(worst)) * 100),
    },
    nextUpgrade: nextUpgrade(leaning, usable),
    verdict: verdictFor(leaning, cpuLed.length, gpuLed.length, usable.length),
  }
}

const ratio = (r) => Math.min(r.gpuOnlyFps, r.cpuOnlyFps) / Math.max(r.gpuOnlyFps, r.cpuOnlyFps)

function nextUpgrade(leaning, usable) {
  if (leaning === 'cpu') {
    return {
      category: 'cpu',
      reason: 'The processor is setting the pace in most of these games, so a faster '
        + 'graphics card would spend much of its time waiting. The CPU is where the '
        + 'next frames are.',
    }
  }
  // GPU-led is the healthy arrangement, so this is guidance rather than a fault.
  const wasted = usable.filter((r) => ratio(r) < WASTED_GPU_BELOW && r.limitedBy === 'gpu')
  return {
    category: 'gpu',
    reason: wasted.length >= usable.length / 2
      ? 'The graphics card is the limit almost everywhere and the processor has plenty '
        + 'left over. That is the normal, healthy arrangement — and it means a card '
        + 'upgrade would translate almost directly into frames.'
      : 'The graphics card leads, which is what you want. A card upgrade is where extra '
        + 'money buys the most, though the processor will start to catch up.',
  }
}

function verdictFor(leaning, cpuLed, gpuLed, total) {
  if (leaning === 'cpu') {
    return `Processor-limited in ${cpuLed} of ${total} games — the graphics card has capacity going unused.`
  }
  if (leaning === 'gpu') {
    return `Graphics-limited in ${gpuLed} of ${total} games, which is the healthy arrangement: the card is the part doing the work.`
  }
  return `Well matched — neither part dominates across ${total} games.`
}
