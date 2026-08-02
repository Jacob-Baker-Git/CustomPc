import { assemblyLayout } from '../lib/assemblyLayout'
import { partCentre } from '../lib/assemblyGeometry'
import { PART_SPECS } from '../lib/partSpecs'

// Every part that mounts to the board. `case` is positioned separately (on the
// case interior) and is checked on its own below.
const MOUNTED = ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu']

describe('assemblyLayout', () => {
  it('places the motherboard at the origin', () => {
    expect(assemblyLayout('motherboard').position).toEqual([0, 0, 0])
  })

  it('stands the motherboard vertical (non-zero rotation)', () => {
    expect(assemblyLayout('motherboard').rotation.some((v) => v !== 0)).toBe(true)
  })

  it('positions every mounted part at its real partCentre, oriented by its spec', () => {
    for (const cat of MOUNTED) {
      expect(assemblyLayout(cat).position, cat).toEqual(partCentre(cat))
      expect(assemblyLayout(cat).rotation, cat).toEqual(PART_SPECS[cat].rotation ?? [0, 0, 0])
    }
  })

  // The whole point of the change: the position must not depend on what else is
  // selected. Passing wildly different selections must yield an identical result.
  it('is selection-independent — same position whatever else is selected', () => {
    const selections = [undefined, {}, { motherboard: { id: 'mb' } }, { gpu: { id: 'g' }, psu: { id: 'p' } }]
    for (const cat of [...MOUNTED, 'case']) {
      const positions = selections.map((sel) => assemblyLayout(cat, sel).position)
      for (const p of positions) expect(p, cat).toEqual(positions[0])
    }
  })

  it('mounts the cooler sitting on the CPU (same Z or further toward the glass)', () => {
    expect(assemblyLayout('cooler').position[2]).toBeGreaterThanOrEqual(assemblyLayout('cpu').position[2])
  })

  it('mounts the GPU in front of the board plane so it is visible', () => {
    expect(assemblyLayout('gpu').position[2]).toBeGreaterThan(0)
  })

  it('centres the case on its interior', () => {
    const t = assemblyLayout('case')
    expect(t.position).toHaveLength(3)
    expect(t.rotation).toEqual([0, 0, 0])
  })

  it('returns a default transform for an unknown category', () => {
    const t = assemblyLayout('banana')
    expect(t.position).toEqual([0, 0, 0])
    expect(t.rotation).toEqual([0, 0, 0])
  })

  it('always returns a position and rotation triple', () => {
    for (const cat of [...MOUNTED, 'case', 'fans', 'paste']) {
      const t = assemblyLayout(cat)
      expect(t.position, cat).toHaveLength(3)
      expect(t.rotation, cat).toHaveLength(3)
    }
  })
})
