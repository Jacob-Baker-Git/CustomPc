import { describe, it, expect } from 'vitest'
import { gbp, gbp2 } from '../lib/money'

describe('money', () => {
  it('writes whole pounds with a thousands comma', () => {
    expect(gbp(1599.41)).toBe('£1,599')
    expect(gbp(84.99)).toBe('£85')
    expect(gbp(0)).toBe('£0')
  })
  it('keeps pence when asked', () => {
    expect(gbp2(1599.41)).toBe('£1,599.41')
    expect(gbp2(999.9)).toBe('£999.90')
  })
})
