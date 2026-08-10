// The one bridge between a selected catalogue part and the geometry's own specs.
//
// PART_SPECS records one representative dimension per category, measured off the
// shipped mesh — but the catalogue holds the real figure for the actual part the
// user picked, and for a graphics card that figure varies enormously: 145 mm to
// 357 mm across the 79 cards on sale. Rendering every one of them at the spec's
// 300 mm made a compact card look huge and a flagship look stubby.
//
// This module exists so exactly one place knows that a GPU part's `length` field
// means "millimetres, front to back". The geometry stays part-agnostic and takes
// a plain override map; the renderer takes the same map, which is what stops the
// two disagreeing about how long the card is — this scene's oldest bug.
//
// Nothing is invented. A part with no usable length yields no override, so the
// geometry falls back to its own measured spec rather than to a guess.

const positive = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined)

export function sizeOverrides(selectedParts = {}) {
  const out = {}
  const gpuLength = positive(selectedParts?.gpu?.length)
  if (gpuLength !== undefined) out.gpu = { lengthMm: gpuLength }
  return out
}
