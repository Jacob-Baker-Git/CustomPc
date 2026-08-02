import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateFeedback, submitFeedback } from '../lib/feedback'

describe('validateFeedback', () => {
  it('accepts a complete valid entry', () => {
    expect(validateFeedback({ rating: 5, type: 'idea', message: 'Great tool' }).ok).toBe(true)
  })
  it('rejects a bad rating, a bad type and an empty message', () => {
    expect(validateFeedback({ rating: 0, type: 'idea', message: 'x' }).errors.rating).toBeTruthy()
    expect(validateFeedback({ rating: 5, type: 'nope', message: 'x' }).errors.type).toBeTruthy()
    expect(validateFeedback({ rating: 5, type: 'bug', message: '  ' }).errors.message).toBeTruthy()
  })
})

describe('submitFeedback', () => {
  beforeEach(() => { globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) })
  it('POSTs a trimmed payload and resolves on success', async () => {
    await submitFeedback({ rating: 4, type: 'praise', message: '  nice  ' })
    const [url, opts] = globalThis.fetch.mock.calls[0]
    expect(url).toMatch(/\/rest\/v1\/feedback$/)
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body).toEqual({ rating: 4, type: 'praise', message: 'nice' })
  })

  // The privacy page states we collect no email address. If a caller ever passes
  // one it must not reach the wire, or that statement quietly becomes false.
  it('never transmits an email, even if one is passed in', async () => {
    await submitFeedback({ rating: 4, type: 'bug', message: 'x', email: 'someone@example.com' })
    const body = globalThis.fetch.mock.calls[0][1].body
    expect(body).not.toContain('email')
    expect(body).not.toContain('someone@example.com')
  })
  it('throws on an invalid entry without calling fetch', async () => {
    await expect(submitFeedback({ rating: 9, type: 'bug', message: 'x' })).rejects.toThrow()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
  it('throws on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(submitFeedback({ rating: 4, type: 'bug', message: 'x' })).rejects.toThrow(/500/)
  })
})
