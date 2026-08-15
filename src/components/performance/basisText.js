// How each tier is named on screen, and why, in words a reader can act on.
//
// Extracted from FpsCard so the card and the grouped frame-rate table cannot
// drift apart while both exist. The table replaces the card in a later task;
// until then two components render the same tiers, and two copies of these
// strings would be two things to keep in step.
//
// `spec-derived` and `ceiling` deliberately share a label. The difference
// between them is the "up to" / ≤ marker, which `bound` drives — not the tier
// name. Giving them separate names would imply a distinction the reader is
// already being shown a better way.
export const BASIS_LABEL = {
  measured: 'benchmarked',
  modelled: 'backed by real data',
  'spec-derived': 'estimate',
  ceiling: 'estimate',
}

// Keys are the caveat ids composed by rowBasis.js. A caveat says how a number
// was DERIVED, so every one of these is a statement about provenance rather
// than about the hardware.
export const CAVEAT_TEXT = {
  'gpu-index-prior': 'The graphics card index came from its specs, not a benchmark of this card.',
  'cpu-index-prior': 'The processor index came from its specs, not a benchmark of this chip.',
  'no-cpu-constant': 'No review has measured processor performance in this game, so this is the graphics card’s ceiling.',
  'resolution-copied': 'No data at this resolution for this card; the figure is carried across from 1440p.',
  'index-extrapolated': 'This part sits outside the range the estimate was worked out over, so it is rougher than the ± figure suggests.',
}
