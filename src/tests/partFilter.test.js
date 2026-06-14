import { filterParts } from '../lib/partFilter'
import partsData from '../data/partsData.json'

const cpus = partsData.filter((p) => p.category === 'cpu')
const mbAM5 = partsData.find((p) => p.id === 'mb-asus-x670e')

describe('filterParts', () => {
  it('default view hides incompatible parts', () => {
    // With an AM5 motherboard, Intel (LGA1700) CPUs are incompatible
    const res = filterParts(cpus, { motherboard: mbAM5 }, 5000, '')
    const ids = res.map((r) => r.part.id)
    expect(ids).not.toContain('cpu-i7-13700k')
    expect(ids).toContain('cpu-ryzen-7-7700x')
  })

  it('default view hides parts over 70% of budget', () => {
    const cheap = { id: 'x1', category: 'cpu', name: 'Cheap', price: 100, socket: 'AM5', tdp: 50 }
    const dear  = { id: 'x2', category: 'cpu', name: 'Dear',  price: 800, socket: 'AM5', tdp: 50 }
    const res = filterParts([cheap, dear], { motherboard: mbAM5 }, 1000, '')
    const ids = res.map((r) => r.part.id)
    expect(ids).toContain('x1')      // 100 <= 700
    expect(ids).not.toContain('x2')  // 800 > 700
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
})
