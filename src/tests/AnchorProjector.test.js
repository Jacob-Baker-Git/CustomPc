import { describe, it, expect } from 'vitest'
import { SHOWROOM_SLOTS } from '../lib/showroomSlots'
import { anchorWorldPoint, ANCHOR_OFFSET, seenThroughGlass } from '../lib/showroom'
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

describe('seenThroughGlass', () => {
  const box = { min: [-1, -1, -1], max: [1, 1, 1] }
  const p = [0, 0, 0]
  it('front of the glass sees in', () => expect(seenThroughGlass([0.5, 0.3, 6], p, box)).toBe(true))
  it('behind the tray does not', () => expect(seenThroughGlass([0, 0, -6], p, box)).toBe(false))
  it('through the front or rear panel does not', () => {
    expect(seenThroughGlass([6, 0, 1.5], p, box)).toBe(false)
    expect(seenThroughGlass([-6, 0, 1.5], p, box)).toBe(false)
  })
  it('steeply from above comes in through the roof', () => expect(seenThroughGlass([0, 6, 1.5], p, box)).toBe(false))
  it('glass-side corner view still enters by the glass', () => expect(seenThroughGlass([2, 1.5, 6], p, box)).toBe(true))
  it('eye inside the box sees everything', () => expect(seenThroughGlass([0.5, 0.5, -0.5], p, box)).toBe(true))
  it('default box is the case interior: default camera sees the CPU', () => {
    expect(seenThroughGlass([2.5, 1.3, 6.8], anchorWorldPoint('cpu', {}))).toBe(true)
    expect(seenThroughGlass([0.4, 0, -6], anchorWorldPoint('cpu', {}))).toBe(false)
  })
})
