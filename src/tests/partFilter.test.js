import { filterParts } from '../lib/partFilter'
import partsData from '../data/partsData.json'

const cpus = partsData.filter((p) => p.category === 'cpu')
const mbAM5 = partsData.find((p) => p.id === 'mb-asus-x670e')

describe('filterParts', () => {
  it('default view keeps incompatible parts visible but marked locked', () => {
    // With an AM5 motherboard, Intel (LGA1700) CPUs show as locked, not hidden.
    const res = filterParts(cpus, { motherboard: mbAM5 }, 5000, '')
    const intel = res.find((r) => r.part.id === 'cpu-i7-13700k')
    expect(intel).toBeDefined()
    expect(intel.compatible).toBe(false)
    expect(intel.reason).toMatch(/socket/i)
    expect(res.find((r) => r.part.id === 'cpu-ryzen-7-7700x').compatible).toBe(true)
  })

  it('default view hides parts over 60% of budget', () => {
    const cheap = { id: 'x1', category: 'cpu', name: 'Cheap', price: 550, socket: 'AM5', tdp: 50 }
    const dear  = { id: 'x2', category: 'cpu', name: 'Dear',  price: 650, socket: 'AM5', tdp: 50 }
    const res = filterParts([cheap, dear], { motherboard: mbAM5 }, 1000, '')
    const ids = res.map((r) => r.part.id)
    expect(ids).toContain('x1')      // 550 <= 600 (60% of 1000)
    expect(ids).not.toContain('x2')  // 650 > 600
  })

  it('search reveals matching parts even if incompatible', () => {
    const res = filterParts(cpus, { motherboard: mbAM5 }, 5000, 'i7-13700')
    const ids = res.map((r) => r.part.id)
    expect(ids).toContain('cpu-i7-13700k')
    expect(res.find((r) => r.part.id === 'cpu-i7-13700k').compatible).toBe(false)
  })

  it('search reveals matching parts even if over budget', () => {
    const dear = { id: 'x2', category: 'cpu', name: 'Dear CPU', price: 800, socket: 'AM5', tdp: 50 }
    const res = filterParts([dear], { motherboard: mbAM5 }, 1000, 'dear')
    expect(res.map((r) => r.part.id)).toContain('x2')
  })

  it('with budget 0 the 70% rule does not hide anything', () => {
    const res = filterParts(cpus.filter((c) => c.socket === 'AM5'), { motherboard: mbAM5 }, 0, '')
    expect(res.length).toBeGreaterThan(0)
  })

  it('brand filter narrows results to a single brand', () => {
    const res = filterParts(cpus, {}, 0, '', 'AMD')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((r) => r.part.brand === 'AMD')).toBe(true)
  })

  it("brand 'all' or undefined returns the unfiltered set", () => {
    const all = filterParts(cpus, {}, 0, '').map((r) => r.part.id)
    const explicit = filterParts(cpus, {}, 0, '', 'all').map((r) => r.part.id)
    expect(explicit).toEqual(all)
  })

  it('brand and search combine (both narrow)', () => {
    const res = filterParts(cpus, {}, 0, 'core', 'Intel')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((r) => r.part.brand === 'Intel')).toBe(true)
    expect(res.every((r) => /core/i.test(r.part.name))).toBe(true)
  })
})
