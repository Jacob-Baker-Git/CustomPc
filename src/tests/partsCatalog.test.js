import partsData from '../data/partsData.json'

const byCat = (c) => partsData.filter((p) => p.category === c)

describe('parts catalog integrity', () => {
  it('has unique ids', () => {
    const ids = partsData.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every part has the core fields', () => {
    for (const p of partsData) {
      expect(p.id, p.name).toBeTruthy()
      expect(p.category).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.brand, p.id).toBeTruthy()
      expect(p.price, p.id).toBeGreaterThan(0)
    }
  })

  it('category-specific compatibility fields are present', () => {
    for (const p of byCat('cpu')) {
      expect(p.socket, p.id).toBeTruthy()
      expect(p.perfScore, p.id).toBeGreaterThan(0)
    }
    for (const p of byCat('gpu')) {
      expect(p.perfScore, p.id).toBeGreaterThan(0)
      expect(p.length, p.id).toBeGreaterThan(0)
    }
    for (const p of byCat('motherboard')) {
      expect(p.socket, p.id).toBeTruthy()
      expect(p.ramType, p.id).toBeTruthy()
      expect(p.formFactor, p.id).toBeTruthy()
    }
    for (const p of byCat('ram')) {
      expect(p.ramType, p.id).toBeTruthy()
      expect(p.capacityGb, p.id).toBeGreaterThan(0)
    }
    for (const p of byCat('psu')) expect(p.wattage, p.id).toBeGreaterThan(0)
    for (const p of byCat('case')) {
      expect(p.maxGpuLength, p.id).toBeGreaterThan(0)
      expect(p.maxCoolerHeight, p.id).toBeGreaterThan(0)
      expect(Array.isArray(p.supportedFormFactors), p.id).toBe(true)
    }
    for (const p of byCat('cooler')) expect(Array.isArray(p.sockets), p.id).toBe(true)
  })

  it('offers a reasonably broad selection in every category', () => {
    const minimums = {
      cpu: 31, gpu: 30, motherboard: 30, ram: 26, storage: 26,
      psu: 26, case: 25, cooler: 25, fans: 22, paste: 8,
    }
    for (const [cat, min] of Object.entries(minimums)) {
      expect(byCat(cat).length, cat).toBeGreaterThanOrEqual(min)
    }
  })
})
