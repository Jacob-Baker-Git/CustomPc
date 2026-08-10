import * as THREE from 'three'
import {
  partSize, partCentre, partBox, pcbBox, meshLocalSize, caseInterior, CASE,
} from '../lib/assemblyGeometry'
import { sizeOverrides } from '../lib/partOverrides'
import { assemblyLayout } from '../lib/assemblyLayout'
import { gltfModelFor } from '../lib/gltfModels'
import { cableRoutes, pcieConnector } from '../lib/cableRoutes'
import { FAN_MOUNTS, FAN_HALF_DEPTH } from '../lib/fanMounts'
import { PART_SPECS } from '../lib/partSpecs'
import { mm, FAN_MM } from '../lib/pcScale'
import parts from '../data/partsData.json'

// Every distinct GPU length in the shipped catalogue, so a newly added card with
// an unusual length is swept without anyone remembering to list it here.
const CATALOGUE_LENGTHS = [...new Set(
  parts.filter((p) => p.category === 'gpu' && Number.isFinite(p.length)).map((p) => p.length),
)].sort((a, b) => a - b)

const forLength = (lengthMm) => sizeOverrides({ gpu: { length: lengthMm } })

// The two dimensions a card's length must NOT drag with it. A uniform fit would:
// scaling a 300 mm mesh down to 145 mm would render the card 21 mm thick and
// 62 mm tall, when a real short card keeps the same PCIe bracket height and slot
// thickness as a long one. Round nine's M.2 bug was this exact mistake.
const PINNED_AXES = [1, 2]

describe('sizeOverrides', () => {
  it('turns a selected card\'s catalogue length into a geometry override', () => {
    expect(sizeOverrides({ gpu: { length: 250 } })).toEqual({ gpu: { lengthMm: 250 } })
  })

  it('is empty without a card, so the geometry keeps its own default', () => {
    expect(sizeOverrides({})).toEqual({})
    expect(sizeOverrides()).toEqual({})
  })

  // Never invent a dimension. A card with no recorded length falls back to the
  // spec's own figure rather than to a guess — same rule as partStats.js.
  it('ignores a card with no usable length rather than inventing one', () => {
    expect(sizeOverrides({ gpu: {} })).toEqual({})
    expect(sizeOverrides({ gpu: { length: 0 } })).toEqual({})
    expect(sizeOverrides({ gpu: { length: 'long' } })).toEqual({})
  })

  it('names only the categories it has a dimension for', () => {
    expect(sizeOverrides({ gpu: { length: 250 }, cpu: {}, psu: {} })).toEqual({ gpu: { lengthMm: 250 } })
  })
})

describe('a card\'s rendered length follows the selected card', () => {
  it('renders the spec\'s own length when nothing is overridden', () => {
    expect(partSize('gpu')[0]).toBeCloseTo(mm(PART_SPECS.gpu.lengthMm), 9)
  })

  it('renders the overridden length instead', () => {
    expect(partSize('gpu', forLength(145))[0]).toBeCloseTo(mm(145), 9)
    expect(partSize('gpu', forLength(357))[0]).toBeCloseTo(mm(357), 9)
  })

  // The whole reason this is a per-axis stretch and not a uniform rescale.
  it('leaves the card\'s thickness and bracket height alone', () => {
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const stretched = partSize('gpu', forLength(lengthMm))
      for (const axis of PINNED_AXES) {
        expect(stretched[axis], `length ${lengthMm} axis ${axis}`).toBeCloseTo(partSize('gpu')[axis], 9)
      }
    }
  })

  it('is a no-op at the spec\'s own length', () => {
    const ov = forLength(PART_SPECS.gpu.lengthMm)
    expect(partSize('gpu', ov)).toEqual(partSize('gpu'))
    expect(partCentre('gpu', ov)).toEqual(partCentre('gpu'))
  })

  it('is a no-op when handed no overrides at all', () => {
    expect(partSize('gpu', {})).toEqual(partSize('gpu'))
    expect(partCentre('gpu', {})).toEqual(partCentre('gpu'))
  })
})

// MOUNTS.gpu.pcbRearMm exists precisely so length can change without dragging
// the edge connector out of the slot. Round seven added that anchor for this.
describe('changing the length never moves the edge connector', () => {
  it('keeps the PCB\'s leading edge on the slot for every catalogue length', () => {
    const seated = pcbBox('gpu').min[0]
    for (const lengthMm of CATALOGUE_LENGTHS) {
      expect(pcbBox('gpu', forLength(lengthMm)).min[0], `length ${lengthMm}`).toBeCloseTo(seated, 9)
    }
  })

  it('keeps the PCB on the slot\'s centreline for every catalogue length', () => {
    const centreline = (box) => (box.min[1] + box.max[1]) / 2
    for (const lengthMm of CATALOGUE_LENGTHS) {
      expect(centreline(pcbBox('gpu', forLength(lengthMm))), `length ${lengthMm}`)
        .toBeCloseTo(centreline(pcbBox('gpu')), 9)
    }
  })

  // The bracket end CANNOT also be pinned, and it is worth being precise about
  // why rather than discovering it again.
  //
  // This mesh draws its PCB's leading edge about 18 mm forward of the bracket
  // face, and a single per-axis scale scales that gap along with everything else
  // — so pinning the notch lets the bracket drift, and pinning the bracket (what
  // `rearInsetMm` used to do) drifts the notch by the same amount instead. Only a
  // mesh whose rear section did not scale could hold both, which no single scale
  // factor can express.
  //
  // The notch wins: a connector out of its slot is the defect users reported and
  // drew arrows on, and MOUNTS.gpu.pcbRearMm exists specifically to hold it. The
  // bracket's drift is bounded by that 18 mm gap and is zero at the spec's own
  // length, which is what these two assertions pin. Do NOT "fix" this by
  // re-anchoring on the bracket — that trades a bounded gap in a dark corner for
  // a visibly unplugged card.
  const MAX_BRACKET_GAP_MM = 9

  it('sits the bracket exactly in the rear panel at the spec\'s own length', () => {
    const inner = caseInterior()
    const bracket = partBox('gpu', forLength(PART_SPECS.gpu.lengthMm)).min[0]
    expect(bracket).toBeLessThanOrEqual(inner.min[0])
    expect(bracket).toBeGreaterThanOrEqual(inner.min[0] - mm(CASE.panelMm) - mm(4))
  })

  it('keeps the bracket within a bounded gap of the rear panel at every length', () => {
    const inner = caseInterior()
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const gap = partBox('gpu', forLength(lengthMm)).min[0] - inner.min[0]
      // Never further out than the panel it bolts through...
      expect(gap, `length ${lengthMm}`).toBeGreaterThanOrEqual(-mm(CASE.panelMm) - mm(4))
      // ...and never floating further inside it than the mesh's own rear overhang.
      expect(gap, `length ${lengthMm}`).toBeLessThanOrEqual(mm(MAX_BRACKET_GAP_MM))
    }
  })

  it('grows a longer card forward, keeping the same end in the slot', () => {
    const short = partBox('gpu', forLength(145))
    const long = partBox('gpu', forLength(357))
    expect(long.max[0]).toBeGreaterThan(short.max[0])
    // Both ends move a little because the whole mesh scales, but the notch — the
    // thing that has to stay in the slot — does not: pinned above.
    expect(long.max[0] - short.max[0]).toBeGreaterThan(mm(357 - 145) * 0.9)
  })
})

// The card must not be able to resize the machine around it. caseInterior() is
// anchored off the board on all three axes and nothing else; a case that grew
// with the card would make every other part move when the GPU changed.
describe('the card cannot move anything else', () => {
  it('never resizes the case', () => {
    const before = caseInterior()
    for (const lengthMm of CATALOGUE_LENGTHS) {
      forLength(lengthMm)
      expect(caseInterior()).toEqual(before)
    }
  })

  it('applies only to the category it names', () => {
    const ov = forLength(357)
    for (const category of ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'psu']) {
      expect(partCentre(category, ov), `${category} centre`).toEqual(partCentre(category))
      expect(partSize(category, ov), `${category} size`).toEqual(partSize(category))
    }
  })

  // A silently ignored override is the failure mode this codebase keeps finding.
  // A part sized by `sizeMm` names all three world axes explicitly, so there is
  // no single "length" to override — say so rather than rendering the default.
  it('refuses an override for a part sized per-axis instead of ignoring it', () => {
    expect(() => partSize('psu', { psu: { lengthMm: 200 } })).toThrow(/sizeMm/)
  })
})

describe('every catalogue card fits the machine it is drawn in', () => {
  const OTHERS = ['cpu', 'ram', 'storage', 'psu']

  // Smallest per-axis overlap; positive on all three axes means a real collision.
  const overlap = (a, b) => {
    let least = Infinity
    for (let i = 0; i < 3; i++) {
      least = Math.min(least, Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]))
    }
    return least
  }

  it('never drives a card into another part', () => {
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const gpu = partBox('gpu', forLength(lengthMm))
      for (const other of OTHERS) {
        expect(overlap(gpu, partBox(other)), `${lengthMm} mm card vs ${other}`).toBeLessThanOrEqual(1e-6)
      }
    }
  })

  it('keeps every card inside the case, bracket aside', () => {
    const inner = caseInterior()
    const slack = mm(CASE.panelMm) + mm(4)
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const box = partBox('gpu', forLength(lengthMm))
      for (let i = 0; i < 3; i++) {
        expect(box.min[i], `${lengthMm} mm axis ${i} min`).toBeGreaterThanOrEqual(inner.min[i] - slack - 1e-6)
        expect(box.max[i], `${lengthMm} mm axis ${i} max`).toBeLessThanOrEqual(inner.max[i] + slack + 1e-6)
      }
    }
  })

  it('never drives a card into the intake fans', () => {
    const half = mm(FAN_MM) / 2
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const box = partBox('gpu', forLength(lengthMm))
      for (const { position: [fx, fy, fz] } of FAN_MOUNTS) {
        const clear =
          box.max[0] <= fx - FAN_HALF_DEPTH + 1e-6 || box.min[0] >= fx + FAN_HALF_DEPTH - 1e-6 ||
          box.max[1] <= fy - half + 1e-6 || box.min[1] >= fy + half - 1e-6 ||
          box.max[2] <= fz - half + 1e-6 || box.min[2] >= fz + half - 1e-6
        expect(clear, `${lengthMm} mm card vs fan at ${fx},${fy},${fz}`).toBe(true)
      }
    }
  })
})

// The renderer and the geometry must agree about how long the card is. Letting
// only one of them know is this scene's oldest and most repeated bug: the mesh
// would draw one length while every mount point, cable end and collision box
// was computed for another.
describe('the render agrees with the geometry', () => {
  it('places the mesh where partCentre puts the card', () => {
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const ov = forLength(lengthMm)
      expect(assemblyLayout('gpu', ov).position, `length ${lengthMm}`).toEqual(partCentre('gpu', ov))
    }
  })

  it('stretches the mesh to the same length the geometry uses', () => {
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const ov = forLength(lengthMm)
      expect(gltfModelFor('gpu', ov).targetSize, `length ${lengthMm}`).toEqual(meshLocalSize('gpu', ov))
    }
  })

  it('hands the renderer the default model when nothing is overridden', () => {
    expect(gltfModelFor('gpu').targetSize).toEqual(gltfModelFor('gpu', {}).targetSize)
  })
})

describe('the loom follows the card', () => {
  const sample = (route, n = 300) =>
    new THREE.CatmullRomCurve3(route.points.map((p) => new THREE.Vector3(...p))).getPoints(n)

  const penetration = (p, box) => {
    const v = [p.x, p.y, p.z]
    let depth = Infinity
    for (let i = 0; i < 3; i++) depth = Math.min(depth, Math.min(v[i] - box.min[i], box.max[i] - v[i]))
    return Math.max(0, depth)
  }

  const TOUCH_MM = 4

  it('lands the PCIe lead on the card\'s own inlet whatever its length', () => {
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const selected = { motherboard: {}, psu: {}, gpu: { length: lengthMm } }
      const route = cableRoutes(selected).find((r) => r.id === 'pcie')
      const inlet = pcieConnector(sizeOverrides(selected))
      const box = partBox('gpu', sizeOverrides(selected))
      // The inlet is a measured node on the card, so it has to travel with it.
      expect(inlet[0], `length ${lengthMm}`).toBeGreaterThan(box.min[0])
      expect(inlet[0], `length ${lengthMm}`).toBeLessThan(box.max[0])
      const end = sample(route).at(-1)
      expect(end.distanceTo(new THREE.Vector3(...inlet)), `length ${lengthMm}`).toBeLessThan(mm(1))
    }
  })

  it('keeps every cable clear of the card and the intake fans at any length', () => {
    const half = mm(FAN_MM) / 2
    for (const lengthMm of CATALOGUE_LENGTHS) {
      const selected = { motherboard: {}, psu: {}, gpu: { length: lengthMm } }
      const ov = sizeOverrides(selected)
      const gpu = partBox('gpu', ov)
      const inlet = new THREE.Vector3(...pcieConnector(ov))
      for (const route of cableRoutes(selected)) {
        const thickHalf = FAN_HALF_DEPTH + mm(route.radiusMm)
        for (const p of sample(route)) {
          if (p.distanceTo(inlet) >= mm(30)) {
            expect(penetration(p, gpu), `${route.id} through a ${lengthMm} mm card`).toBeLessThan(mm(TOUCH_MM))
          }
          for (const { position: [fx, fy, fz] } of FAN_MOUNTS) {
            const clear =
              Math.abs(p.x - fx) > thickHalf || Math.abs(p.y - fy) > half || Math.abs(p.z - fz) > half
            expect(clear, `${route.id} into a fan with a ${lengthMm} mm card`).toBe(true)
          }
        }
      }
    }
  })
})
