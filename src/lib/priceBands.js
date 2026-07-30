// Price filters for the peripherals tab, in real money.
//
// These used to be one global Value/Mid/High-end row resolved against
// per-category terciles, so a single chip meant ~£30 for a mouse and ~£300 for
// a monitor at the same time and the label admitted neither. Boundaries are now
// per category and stated as numbers.

// Boundaries snap to this ladder so a label never reads "£137".
const LADDER = [10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

const ALL = { id: 'all', label: 'All', min: 0, max: Infinity }

export function snapToLadder(price) {
  return LADDER.reduce((best, v) => (Math.abs(v - price) < Math.abs(best - price) ? v : best), LADDER[0])
}

export function inBand(price, band) {
  return price >= band.min && price < band.max
}

export function priceBands(prices) {
  const sorted = [...prices].filter((p) => Number.isFinite(p)).sort((a, b) => a - b)
  // Under four options a filter costs more attention than it saves.
  if (sorted.length < 4) return [ALL]

  const first = snapToLadder(sorted[Math.floor(sorted.length / 3)])
  const second = snapToLadder(sorted[Math.floor((2 * sorted.length) / 3)])
  const cuts = first === second ? [first] : [first, second]

  const bands = []
  let lo = 0
  for (const cut of cuts) {
    bands.push({
      id: `under-${cut}`,
      label: lo === 0 ? `Under £${cut}` : `£${lo}–£${cut}`,
      min: lo,
      max: cut,
    })
    lo = cut
  }
  bands.push({ id: `over-${lo}`, label: `£${lo}+`, min: lo, max: Infinity })

  // Snapping can push a boundary past every item; an empty chip is noise.
  return [ALL, ...bands.filter((b) => sorted.some((p) => inBand(p, b)))]
}
