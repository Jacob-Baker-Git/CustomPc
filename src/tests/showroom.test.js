import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { SHOWROOM_SLOTS, COMPACT_IDS, focusChange, formatDelta, priceShares } from '../lib/showroomSlots'
import { projectAnchor } from '../lib/showroom'

const opt = (o) => ({ parts: Object.fromEntries(Object.entries(o).map(([k, p]) => [k, { price: p }])) })

describe('showroom', () => {
  it('slots', () => {
    expect(SHOWROOM_SLOTS.filter(s => s.side === 'l').map(s => s.id)).toEqual(['cooler', 'motherboard', 'storage', 'psu'])
    expect(SHOWROOM_SLOTS.filter(s => s.side === 'r').map(s => s.id)).toEqual(['ram', 'cpu', 'gpu'])
    expect(COMPACT_IDS).toEqual(['cpu', 'gpu', 'cooler', 'psu'])
  })
  it('focusChange picks largest anchored change', () => {
    const prev = opt({ cpu: 200, gpu: 500 })
    const next = opt({ cpu: 230, gpu: 595 })
    const f = focusChange(prev, next, new Set(['cpu', 'gpu']))
    expect(f).toMatchObject({ id: 'gpu', delta: 95, others: ['cpu'], anchored: true })
    expect(f.part).toBe(next.parts.gpu)
  })
  it('falls back to unanchored case', () => {
    const f = focusChange(opt({ case: 50 }), opt({ case: 150 }), new Set(['case']))
    expect(f).toMatchObject({ id: 'case', anchored: false, delta: 100, others: [] })
  })
  it('prefers anchored over bigger unanchored; null when empty', () => {
    const f = focusChange(opt({ case: 0, cpu: 0 }), opt({ case: 500, cpu: 10 }), new Set(['case', 'cpu']))
    expect(f.id).toBe('cpu')
    expect(f.others).toEqual(['case'])
    expect(focusChange(opt({}), opt({}), new Set())).toBeNull()
  })
  it('formatDelta', () => {
    expect(formatDelta(-40)).toBe('\u2212£40')
    expect(formatDelta(95)).toBe('+£95')
    expect(formatDelta(0)).toBe('£0')
  })
  it('priceShares', () => {
    expect(priceShares({ cpu: { price: 100 }, gpu: { price: 300 } })).toEqual([
      { id: 'cpu', price: 100, pct: 25 }, { id: 'gpu', price: 300, pct: 75 }])
  })
  it('projectAnchor', () => {
    const cam = new THREE.PerspectiveCamera(46, 1)
    cam.position.set(0, 0, 5)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()
    const p = projectAnchor([0, 0, 0], cam)
    expect(p.x).toBeCloseTo(50); expect(p.y).toBeCloseTo(50); expect(p.visible).toBe(true)
    expect(projectAnchor([0, 0, 10], cam).visible).toBe(false)
    expect(projectAnchor([50, 0, 0], cam).visible).toBe(false)
  })
})
