import { describe, it, expect } from 'vitest'
import { partLevel } from '../lib/partRatings'

const cpuLo = { id: 'cpu-lo', category: 'cpu', perfScore: 50 }
const cpuMid = { id: 'cpu-mid', category: 'cpu', perfScore: 150 }
const cpuHi = { id: 'cpu-hi', category: 'cpu', perfScore: 250 }
const gpu = { id: 'g', category: 'gpu', perfScore: 300 }
const catalog = [cpuLo, cpuMid, cpuHi, gpu]

describe('partLevel', () => {
  it('scales the weakest to 0 and strongest to 100 within a category', () => {
    expect(partLevel(cpuLo, catalog)).toBe(0)
    expect(partLevel(cpuHi, catalog)).toBe(100)
    expect(partLevel(cpuMid, catalog)).toBe(50)
  })
  it('a lone part in its category is 100', () => {
    expect(partLevel(gpu, catalog)).toBe(100)
  })
  it('null part is 0', () => {
    expect(partLevel(null, catalog)).toBe(0)
  })
})
