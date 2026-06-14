import { assemblyLayout } from '../lib/assemblyLayout'

const withMb = { motherboard: { id: 'mb-x' } }

describe('assemblyLayout', () => {
  it('places the motherboard at the origin', () => {
    expect(assemblyLayout('motherboard', withMb).position).toEqual([0, 0, 0])
  })

  it('mounts the cooler above the CPU when a motherboard is present', () => {
    const cpuY = assemblyLayout('cpu', withMb).position[1]
    const coolerY = assemblyLayout('cooler', withMb).position[1]
    expect(coolerY).toBeGreaterThan(cpuY)
  })

  it('mounts the GPU above the board so it is visible, not hidden under it', () => {
    expect(assemblyLayout('gpu', withMb).position[1]).toBeGreaterThanOrEqual(0)
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
