// The one-line headline each folded Performance section shows while shut
// (spec 2026-10-16): folding hides the detail, never the answer.
const CHANNELS = { single: 'one stick', dual: 'dual channel' }
const LEANING = { gpu: 'Graphics-limited', cpu: 'Processor-limited' }

function holding(report) {
  const b = report?.bottleneck
  if (!b) return 'Needs benchmark data'
  if (b.leaning === 'cpu' || b.leaning === 'gpu') {
    const n = b.leaning === 'cpu' ? b.cpuLedGames : b.gpuLedGames
    return `${LEANING[b.leaning]} in ${n} of ${b.gamesConsidered} games`
  }
  return `Balanced across ${b.gamesConsidered} games`
}

function power(p) {
  const draw = `${p.gamingW} W gaming`
  if (!p.psuWattage || p.psuHeadroomPct == null) return `${draw} · no supply chosen`
  return p.psuHeadroomPct >= 0
    ? `${draw} · supply has ${p.psuHeadroomPct}% spare`
    : `${draw} · supply is ${-p.psuHeadroomPct}% short`
}

function hardware(m) {
  if (!m?.capacityGb) return 'No memory chosen'
  const size = m.capacityGb >= 1000 && m.capacityGb % 1000 === 0 ? `${m.capacityGb / 1000} TB` : `${m.capacityGb} GB`
  const kind = [size, m.type].filter(Boolean).join(' ')
  return CHANNELS[m.channels] ? `${kind} · ${CHANNELS[m.channels]}` : kind
}

export function perfFoldSummaries({ report, power: p, memory, answered, total }) {
  return {
    holding: holding(report),
    power: power(p),
    hardware: hardware(memory),
    games: `${answered} of ${total} games answered`,
  }
}
