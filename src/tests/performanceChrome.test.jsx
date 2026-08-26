import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Section from '../components/performance/Section'
import { ELEV_GROUP } from '../lib/uiTokens'

describe('Section', () => {
  it('paints an opaque surface, because the board is behind it', () => {
    // The builder passes no `column` to BoardBackground, so there is no scrim.
    // Opaque modules ARE the mechanism that keeps this page readable.
    const { container } = render(<Section title="Frame rates">body</Section>)
    expect(container.querySelector('section').className).toContain(ELEV_GROUP)
  })

  it('keeps the heading inside the module it belongs to', () => {
    // A heading rendered above the surface is exactly what was sitting on bare
    // board: "Frame rates" and its blurb were two of the offenders.
    const { container } = render(<Section title="Frame rates" blurb="A blurb">body</Section>)
    const surface = container.querySelector('section')
    expect(surface.querySelector('h3').textContent).toBe('Frame rates')
    expect(surface.textContent).toContain('A blurb')
  })

  it('does not go back to borders for hierarchy', () => {
    // uiTokens.js records that de-bordering this page was deliberate and that
    // depth carries hierarchy now. Re-adding a rule would reverse that.
    const { container } = render(<Section title="T">body</Section>)
    expect(container.querySelector('section').className).not.toMatch(/\bborder-t\b/)
  })
})
