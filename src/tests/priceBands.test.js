import { describe, it, expect } from 'vitest'
import { snapToLadder, priceBands, inBand } from '../lib/priceBands'
import peripheralsData from '../data/peripheralsData.json'

const pricesFor = (cat) => peripheralsData.filter((p) => p.category === cat).map((p) => p.price)

describe('snapToLadder', () => {
  it('rounds to the nearest friendly number', () => {
    expect(snapToLadder(44.99)).toBe(40)
    expect(snapToLadder(59.99)).toBe(50)
    expect(snapToLadder(159.99)).toBe(150)
    expect(snapToLadder(279.99)).toBe(300)
  })

  it('clamps outside the ladder rather than inventing a value', () => {
    expect(snapToLadder(1)).toBe(10)
    expect(snapToLadder(99999)).toBe(1000)
  })
})

describe('priceBands', () => {
  it('always starts with All', () => {
    expect(priceBands(pricesFor('mouse'))[0]).toMatchObject({ id: 'all', label: 'All' })
  })

  // The whole point of the change: each category resolves to its own numbers.
  it('gives different money boundaries to mice and monitors', () => {
    const mouse = priceBands(pricesFor('mouse')).map((b) => b.label)
    const monitor = priceBands(pricesFor('monitor')).map((b) => b.label)
    expect(mouse).not.toEqual(monitor)
    expect(mouse.join(' ')).toMatch(/£/)
    expect(monitor.join(' ')).toMatch(/£/)
  })

  it('labels bands as real money, never as an abstract tier', () => {
    for (const label of priceBands(pricesFor('keyboard')).map((b) => b.label)) {
      expect(label).not.toMatch(/value|mid|high/i)
    }
  })

  it('every band it returns actually contains something', () => {
    for (const cat of ['monitor', 'keyboard', 'mouse', 'headset']) {
      const prices = pricesFor(cat)
      for (const band of priceBands(prices)) {
        expect(prices.some((p) => inBand(p, band)), `${cat} / ${band.label}`).toBe(true)
      }
    }
  })

  it('the bands partition the catalogue — every item lands in exactly one non-All band', () => {
    for (const cat of ['monitor', 'keyboard', 'mouse', 'headset']) {
      const prices = pricesFor(cat)
      const bands = priceBands(prices).filter((b) => b.id !== 'all')
      for (const p of prices) {
        expect(bands.filter((b) => inBand(p, b)).length, `${cat} / £${p}`).toBe(1)
      }
    }
  })

  it('falls back to All alone for a catalogue too small to band', () => {
    expect(priceBands([10, 20, 30])).toEqual([{ id: 'all', label: 'All', min: 0, max: Infinity }])
    expect(priceBands([])).toEqual([{ id: 'all', label: 'All', min: 0, max: Infinity }])
  })

  it('collapses to two bands when both boundaries snap to the same number', () => {
    const bands = priceBands([48, 49, 50, 51, 52, 53])
    expect(bands).toHaveLength(3) // All + under + over
    expect(bands[1].label).toMatch(/^Under £/)
    expect(bands[2].label).toMatch(/\+$/)
  })
})

describe('inBand', () => {
  it('is inclusive of min and exclusive of max, so boundaries never double-count', () => {
    const band = { id: 'x', label: '£50–£150', min: 50, max: 150 }
    expect(inBand(49.99, band)).toBe(false)
    expect(inBand(50, band)).toBe(true)
    expect(inBand(149.99, band)).toBe(true)
    expect(inBand(150, band)).toBe(false)
  })
})
