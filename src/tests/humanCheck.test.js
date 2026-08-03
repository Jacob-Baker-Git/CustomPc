import { describe, it, expect } from 'vitest'
import { submittedTooFast } from '../lib/humanCheck'

describe('submittedTooFast', () => {
  it('flags a submit inside the floor', () => {
    expect(submittedTooFast(1_000_000, 1_000_900)).toBe(true)
  })

  it('allows a submit past the floor', () => {
    expect(submittedTooFast(1_000_000, 1_004_000)).toBe(false)
  })

  it('honours a custom floor', () => {
    expect(submittedTooFast(0, 500, 200)).toBe(false)
    expect(submittedTooFast(0, 100, 200)).toBe(true)
  })
})
