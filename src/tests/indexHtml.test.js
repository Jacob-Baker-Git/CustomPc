import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('index.html metadata', () => {
  it('has a descriptive title, not the placeholder', () => {
    expect(html).not.toContain('<title>custompc</title>')
    expect(html).toMatch(/<title>[^<]*PC Builder[^<]*<\/title>/)
  })

  it('has description, Open Graph and Twitter card meta', () => {
    expect(html).toContain('name="description"')
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('name="twitter:card"')
  })

  it('paints a dark boot skeleton before JS loads', () => {
    // #0E0F11 is --ground. This said #0F1114 until 2026-08-17 — the ground from
    // the palette RETIRED by the board redesign, which survived the repalette
    // because the DOM sweep looked for the old brand orange and nothing looked
    // for the old ground. Two near-identical near-blacks hide from the eye.
    expect(html).toContain('#0E0F11')
    expect(html).not.toContain('#0F1114')
    expect(html).toMatch(/id="root">[\s\S]*class="boot"[\s\S]*<\/div>/)
  })

  it('puts the pre-CSS ground on <html>, never on <body>', () => {
    // Painting order, not taste. A background on <body> is an in-flow block
    // background and paints AFTER negative-z-index stacking contexts, so it
    // hides BoardBackground entirely. On <html> it propagates to the canvas and
    // paints behind everything. If this ever moves back to <body>, the board
    // silently disappears and no other test notices.
    expect(html).toMatch(/<html[^>]*style="[^"]*background:#0E0F11/)
    expect(html).not.toMatch(/<body[^>]*background:/)
  })
})
