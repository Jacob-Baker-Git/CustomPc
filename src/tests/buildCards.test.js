import { describe, it, expect } from 'vitest'
import { buildCards } from '../lib/buildCards'

const part = (category, id, price) => ({ id, category, price })
const opt = (ids, total, fps) => ({
  parts: Object.fromEntries(Object.entries(ids).map(([c, id]) => [c, part(c, id, 0)])),
  total, fps,
})
const base = { cpu: 'c1', gpu: 'g1', ram: 'r1' }
const ctx = { budget: 1000, fps: 240 }
const result = (o) => ({ cheapest: null, middle: null, best: null, ...o })

describe('buildCards', () => {
  it('orders cheapest, middle, best with titles and step lines', () => {
    const cards = buildCards(result({
      cheapest: opt(base, 744.2, 249),
      middle: opt({ ...base, gpu: 'g2' }, 849.4, 313),
      best: opt({ ...base, cpu: 'c3', gpu: 'g3' }, 999, 364),
    }), ctx)
    expect(cards.map((c) => c.kind)).toEqual(['cheapest', 'middle', 'best'])
    expect(cards.map((c) => c.title)).toEqual(['Cheapest that hits 240 fps', 'Best value', 'Best within £1,000'])
    expect(cards.map((c) => c.step)).toEqual([null, '+£105 · +64 fps over Cheapest', '+£150 · +51 fps over Best value'])
    expect([...cards[1].changed]).toEqual(['gpu'])
    expect([...cards[2].changed].sort()).toEqual(['cpu', 'gpu'])
    expect(cards[0].changed.size).toBe(0)
  })

  it('shows identical parts once, naming both answers', () => {
    const same = opt(base, 900, 250)
    const cards = buildCards(result({ cheapest: same, best: opt(base, 900, 250) }), ctx)
    expect(cards).toHaveLength(1)
    expect(cards[0].kind).toBe('cheapest')
    expect(cards[0].also).toBe('also best within £1,000')
  })

  it('same CPU and GPU with better other parts: same fps, better parts', () => {
    const cards = buildCards(result({
      cheapest: opt(base, 800, 250),
      best: opt({ ...base, ram: 'r2' }, 990, 250),
    }), ctx)
    expect(cards[1].step).toBe('+£190 · same fps, better parts')
    expect([...cards[1].changed]).toEqual(['ram'])
  })

  it('marks a card over budget', () => {
    const cards = buildCards(result({ cheapest: opt(base, 1200, 250), best: opt({ ...base, gpu: 'g0' }, 990, 200) }), ctx)
    expect(cards.find((c) => c.kind === 'cheapest').overBudget).toBe(true)
    expect(cards.find((c) => c.kind === 'best').overBudget).toBe(false)
    // Best is the cheaper, slower card here: say so, never "+£-210".
    expect(cards.find((c) => c.kind === 'best').step).toBe('£210 less · 50 fps fewer than Cheapest')
  })

  it('skips answers that do not exist', () => {
    expect(buildCards(result({ best: opt(base, 990, 200) }), ctx).map((c) => c.kind)).toEqual(['best'])
    expect(buildCards(result({}), ctx)).toEqual([])
  })
})
