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

// Two parts the shipped meshes cannot stand in for at all: the cooler GLB is a
// 240 mm AIO and the storage GLB an M.2 stick, so an air tower or a 2.5"/3.5"
// drive rendered as those was simply the wrong object. These get `boxMm` — a
// real world-axis volume [front-to-back, up, toward the glass] — and are drawn
// procedurally at it (see assemblyGeometry's boxPartCentre).
//
// An air tower's only catalogue dimension is its height off the CPU. Below
// 80 mm it is a low-profile cooler (fan on top); above, a single 120 mm tower
// whose fan hangs on the front of the fin stack, `offsetMm` keeping the fins
// (not the fan) centred over the socket.
const LOW_PROFILE_MM = 80
const TOWER = { finsMm: 55, fanMm: 25, widthMm: 125 }
const LOW = { sideMm: 95 }
// Standard drive envelopes, lying flat on the basement floor.
const DRIVES = {
  HDD: [147, 26.1, 101.6],       // 3.5"
  'SATA SSD': [100, 7, 69.85],   // 2.5"
}

function coolerOverride(cooler) {
  if (cooler?.specs?.type !== 'Air') return undefined
  const h = positive(cooler.specs.height)
  if (h === undefined) return undefined
  if (h < LOW_PROFILE_MM) return { boxMm: [LOW.sideMm, LOW.sideMm, h], lowProfile: true }
  return {
    boxMm: [TOWER.finsMm + TOWER.fanMm, TOWER.widthMm, h],
    offsetMm: [TOWER.fanMm / 2, 0, 0],
    fanMm: TOWER.fanMm,
  }
}

export function sizeOverrides(selectedParts = {}) {
  const out = {}
  const gpuLength = positive(selectedParts?.gpu?.length)
  if (gpuLength !== undefined) out.gpu = { lengthMm: gpuLength }
  const cooler = coolerOverride(selectedParts?.cooler)
  if (cooler) out.cooler = cooler
  const drive = DRIVES[selectedParts?.storage?.storageType]
  if (drive) out.storage = { boxMm: drive }
  return out
}
