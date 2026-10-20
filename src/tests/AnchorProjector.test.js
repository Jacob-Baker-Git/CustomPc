import { describe, it, expect } from 'vitest'
import { SHOWROOM_SLOTS, anchorWorldPoint, ANCHOR_OFFSET } from '../lib/showroom'
import { partCentre } from '../lib/assemblyGeometry'

describe('anchorWorldPoint', () => {
  it('psu = partCentre + its documented face offset', () => {
    const c = partCentre('psu')
    expect(anchorWorldPoint('psu', {})).toEqual(c.map((v, i) => v + ANCHOR_OFFSET.psu[i]))
    expect(ANCHOR_OFFSET.psu.some((v) => v !== 0)).toBe(true)
  })
  it('plain parts sit on partCentre', () => {
    expect(anchorWorldPoint('cpu', {})).toEqual(partCentre('cpu'))
  })
  it('finite for every slot id', () => {
    for (const { id } of SHOWROOM_SLOTS) {
      const p = anchorWorldPoint(id, {})
      expect(p).toHaveLength(3)
      p.forEach((v) => expect(Number.isFinite(v)).toBe(true))
    }
  })
  it('follows the picked card length', () => {
    expect(anchorWorldPoint('gpu', { gpu: { length: 200 } })).not.toEqual(anchorWorldPoint('gpu', { gpu: { length: 340 } }))
  })
})
