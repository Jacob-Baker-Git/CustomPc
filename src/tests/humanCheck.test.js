import { describe, it, expect } from 'vitest'
import { makeChallenge, checkAnswer, submittedTooFast } from '../lib/humanCheck'

describe('makeChallenge', () => {
  it('builds a readable sum whose answer matches the operands', () => {
    const c = makeChallenge(() => 0.5)
    expect(c.question).toBe(`What is ${c.a} + ${c.b}?`)
    expect(c.answer).toBe(c.a + c.b)
  })

  it('keeps both operands in single digits so it stays trivial for humans', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const c = makeChallenge(() => r)
      expect(c.a).toBeGreaterThanOrEqual(2)
      expect(c.a).toBeLessThanOrEqual(9)
      expect(c.b).toBeGreaterThanOrEqual(2)
      expect(c.b).toBeLessThanOrEqual(9)
    }
  })

  it('varies with the random source', () => {
    const lo = makeChallenge(() => 0)
    const hi = makeChallenge(() => 0.999)
    expect(lo.answer).not.toBe(hi.answer)
  })
})

describe('checkAnswer', () => {
  const c = { a: 3, b: 4, question: 'What is 3 + 4?', answer: 7 }

  it('accepts the right number', () => {
    expect(checkAnswer(c, 7)).toBe(true)
    expect(checkAnswer(c, '7')).toBe(true)
    expect(checkAnswer(c, ' 7 ')).toBe(true)
  })

  it('rejects the wrong number', () => {
    expect(checkAnswer(c, 8)).toBe(false)
    expect(checkAnswer(c, '-7')).toBe(false)
  })

  // Number('') is 0, which would silently pass a challenge whose answer was 0.
  // Answers are never 0 here, but the guard keeps that from becoming true later.
  it('rejects empty and non-numeric input', () => {
    expect(checkAnswer(c, '')).toBe(false)
    expect(checkAnswer(c, '   ')).toBe(false)
    expect(checkAnswer(c, null)).toBe(false)
    expect(checkAnswer(c, undefined)).toBe(false)
    expect(checkAnswer(c, 'seven')).toBe(false)
  })
})

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
