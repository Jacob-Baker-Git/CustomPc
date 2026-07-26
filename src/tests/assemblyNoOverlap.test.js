import { partBox, partSize } from '../lib/assemblyGeometry'
import { MOUNTS } from '../lib/mountPoints'
import { mm } from '../lib/pcScale'

// The cooler is deliberately absent. It is an L-shaped assembly — pump block low
// on the board, radiator high above it, tubes between — so its bounding box
// encloses a large volume it does not physically occupy, and the RAM legitimately
// sits inside that empty space. An AABB test would report a collision that isn't
// real. It gets its own targeted assertion below instead.
const PARTS = ['motherboard', 'gpu', 'ram', 'storage', 'psu']

// Pairs allowed to touch, because one physically mounts onto the other.
const MOUNTED_PAIRS = new Set(['gpu|motherboard'])

const key = (a, b) => [a, b].sort().join('|')

// Smallest per-axis overlap. Positive on all three axes means the boxes really
// do intersect; zero or negative means they are clear of each other.
const overlap = (a, b) => {
  const A = partBox(a)
  const B = partBox(b)
  let least = Infinity
  for (let i = 0; i < 3; i++) {
    least = Math.min(least, Math.min(A.max[i], B.max[i]) - Math.max(A.min[i], B.min[i]))
  }
  return least
}

// Flush-mounted parts (ram, gpu, storage) sit with their back face exactly on
// boardFaceZ() by design — zero physical gap. That boundary computes centre
// +half-depth then -half-depth from the same value, which IEEE-754 does not
// guarantee to cancel to exactly zero; this codebase already tolerates that
// (see assemblyGeometry.test.js's `boardFaceZ() - 1e-6` checks). A genuine
// intersection from a misplaced mount point is millimetres wide — many orders
// of magnitude above this floor — so the tolerance cannot hide a real defect.
const TOUCH_EPSILON = 1e-6

describe('assembly has no floating or intersecting parts', () => {
  it('never lets two unrelated parts occupy the same space', () => {
    for (let i = 0; i < PARTS.length; i++) {
      for (let j = i + 1; j < PARTS.length; j++) {
        if (MOUNTED_PAIRS.has(key(PARTS[i], PARTS[j]))) continue
        expect(overlap(PARTS[i], PARTS[j]), `${PARTS[i]} vs ${PARTS[j]}`).toBeLessThanOrEqual(TOUCH_EPSILON)
      }
    }
  })

  it('keeps the two RAM sticks apart from each other', () => {
    expect(mm(MOUNTS.ram.pitchMm)).toBeGreaterThan(partSize('ram')[0])
  })

  // The cooler's own guard, replacing the AABB check it cannot meaningfully take.
  // Its radiator must clear the board's top edge entirely — that is what proves
  // the only part of it crossing RAM height is the empty span between block and
  // radiator, not solid geometry.
  it('lifts the AIO radiator clear of the board, above everything mounted on it', () => {
    const board = partBox('motherboard')
    const cooler = partBox('cooler')
    const radiatorThickness = mm(25)
    expect(cooler.max[1] - radiatorThickness).toBeGreaterThan(board.max[1])
  })
})
