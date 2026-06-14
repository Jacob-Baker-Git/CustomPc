import { assemblyLayout } from '../lib/assemblyLayout'

const withMb = { motherboard: { id: 'mb-x' } }

describe('assemblyLayout', () => {
  it('places the motherboard at the origin', () => {
    expect(assemblyLayout('motherboard', withMb).position).toEqual([0, 0, 0])
  })

  it('stands the motherboard vertical (non-zero rotation)', () => {
    const r = assemblyLayout('motherboard', withMb).rotation
    expect(r.some((v) => v !== 0)).toBe(true)
  })

  it('mounts the cooler in front of the CPU (sitting on it) when a motherboard is present', () => {
    const cpuZ = assemblyLayout('cpu', withMb).position[2]
    const coolerZ = assemblyLayout('cooler', withMb).position[2]
    expect(coolerZ).toBeGreaterThan(cpuZ)
  })

  it('mounts the GPU in front of the board plane so it is visible', () => {
    expect(assemblyLayout('gpu', withMb).position[2]).toBeGreaterThan(0)
  })

  it('gives case fans a mount position when a motherboard is present', () => {
    const t = assemblyLayout('fans', withMb)
    expect(t.position).toHaveLength(3)
    expect(t.rotation).toHaveLength(3)
  })

  it('uses a different (fallback) CPU position when no motherboard is selected', () => {
    const mounted = assemblyLayout('cpu', withMb).position
    const fallback = assemblyLayout('cpu', {}).position
    expect(fallback).not.toEqual(mounted)
  })

  it('returns a default transform for an unknown category', () => {
    const t = assemblyLayout('banana', withMb)
    expect(t.position).toEqual([0, 0, 0])
    expect(t.rotation).toEqual([0, 0, 0])
  })

  it('always returns a position and rotation triple', () => {
    for (const cat of ['cpu', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooler', 'motherboard', 'fans']) {
      const t = assemblyLayout(cat, withMb)
      expect(t.position).toHaveLength(3)
      expect(t.rotation).toHaveLength(3)
    }
  })
})
