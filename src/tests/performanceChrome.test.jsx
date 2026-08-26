import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatPanel from '../components/performance/StatPanel'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

describe('StatPanel designators', () => {
  it('shows the designator it is given', () => {
    const { getByText } = render(<StatPanel title="Memory" designator="DIMM_A2">x</StatPanel>)
    expect(getByText('DIMM_A2')).toBeInTheDocument()
  })

  it('shows nothing when the panel does not own one part', () => {
    // "Bottleneck" is about the CPU/GPU relationship. Naming one of them would
    // be a claim the panel does not make.
    const { container } = render(<StatPanel title="Bottleneck">x</StatPanel>)
    expect(container.querySelector('[data-designator]')).toBeNull()
  })

  it('only uses designators that name a real connector', () => {
    // The value of a designator is that the same part is named the same way
    // everywhere, so the vocabulary is fixed to PartSlot's CONNECTOR map. An
    // invented one breaks exactly that, and reads as decoration.
    const ALLOWED = ['CPU_1', 'CPU_FAN', 'DIMM_A2', 'PCIEX16_1', 'M2_1', 'ATX_PWR', 'BOARD']
    // Read from the project root: under Vitest's transform `import.meta.url`
    // is not a file: URL, so readFileSync rejects it outright.
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/performance/PerformanceScreen.jsx'), 'utf8')
    const used = [...src.matchAll(/designator="([^"]+)"/g)].map((m) => m[1])
    // A control: an empty match set would make the loop below vacuous.
    expect(used.length, 'no designators found to check').toBeGreaterThan(0)
    for (const d of used) expect(ALLOWED, `${d} is not a real connector`).toContain(d)
  })
})
