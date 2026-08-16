import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BoardBackground from '../components/BoardBackground'
import { SCRIM_ALPHA, LINE_FILL_CEILING, hardwareWidth } from '../lib/boardGeometry'

const lines = (c) => c.querySelector('[data-board-layer="lines"]')
const hardware = (c) => [...c.querySelectorAll('[data-board-layer="hardware"]')]

// `el.className` on an SVG element is an SVGAnimatedString, not a string, so
// the usual className assertions silently receive an object.
const classes = (el) => el.getAttribute('class')

// Every painted node inside a layer, with whatever fill it ends up carrying.
// Groups hand their fill down, so an element with no fill of its own inherits
// its ancestor's — walking parents is the only way to know what actually paints.
function fills(layer) {
  return [...layer.querySelectorAll('rect,circle,path,ellipse')].map((el) => {
    let fill = null
    let opacity = 1
    for (let n = el; n && n !== layer.parentNode; n = n.parentNode) {
      if (fill === null && n.getAttribute?.('fill')) fill = n.getAttribute('fill')
      const o = n.getAttribute?.('fill-opacity')
      if (o !== null && o !== undefined) opacity = Math.min(opacity, Number(o))
    }
    return { el, fill: fill ?? 'black', opacity }
  })
}

describe('BoardBackground', () => {
  it('is invisible to assistive tech', () => {
    const { container } = render(<BoardBackground />)
    expect(container.querySelector('[data-board]')).toHaveAttribute('aria-hidden', 'true')
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('draws the three-level trace hierarchy, weighted', () => {
    // The whole reason the drawing does not read flat: power delivery is thick
    // and bright, component outlines sit in the middle, and the signal fan-out
    // is thin and dim. If these ever collapse to one weight the board goes back
    // to looking like a wireframe.
    const { container } = render(<BoardBackground />)
    const weight = (kind) =>
      Number(container.querySelector(`[data-trace="${kind}"]`).getAttribute('stroke-width'))
    const level = (kind) =>
      Number(container.querySelector(`[data-trace="${kind}"]`).getAttribute('stroke-opacity'))

    expect(weight('power')).toBeGreaterThan(weight('outline'))
    expect(weight('outline')).toBeGreaterThan(weight('signal'))
    expect(level('power')).toBeGreaterThan(level('outline'))
    expect(level('outline')).toBeGreaterThan(level('signal'))
  })

  it('keeps every solid gold fill OUT of the full-bleed layer', () => {
    // This is the contrast argument, encoded structurally.
    //
    // Measured: --faint on a full-strength gold pad is 1.46:1, and --ink on the
    // same pad is 1.95:1 — so it is not a "use a lighter text colour" problem.
    // NOTHING readable can sit on a solid gold fill. A 1px trace crossing under
    // text is an interruption; a gold pad behind text is a wall.
    //
    // The full-bleed layer therefore carries line work only. Vias are the one
    // filled thing allowed here, and they are capped, because a 4px dot is
    // small enough to lose to the scrim.
    const { container } = render(<BoardBackground />)
    const solid = fills(lines(container)).filter(
      (f) => f.fill !== 'none' && f.opacity > LINE_FILL_CEILING,
    )
    expect(solid).toEqual([])
  })

  it('puts the solid gold in layers pinned to the viewport edges', () => {
    // Composition cannot guarantee this on its own: preserveAspectRatio="slice"
    // re-crops the full-bleed drawing at every aspect ratio, so a pad that
    // clears the text column on a laptop can land in it on an ultrawide. The
    // hardware lives in its own edge-anchored layers instead, which makes
    // reaching the centre structurally impossible rather than merely unlikely.
    const { container } = render(<BoardBackground column={672} />)
    const layers = hardware(container)
    expect(layers).toHaveLength(2)
    expect(classes(layers[0])).toMatch(/\bleft-0\b/)
    expect(classes(layers[1])).toMatch(/\bright-0\b/)

    const gold = layers.flatMap((l) => fills(l)).filter((f) => f.fill !== 'none' && f.opacity > 0.6)
    expect(gold.length).toBeGreaterThan(0)
  })

  it('hides the hardware layers when there is no gutter to put them in', () => {
    // Below lg the content column IS the viewport. There is nowhere for an
    // edge-pinned layer to go that is not under the text.
    const { container } = render(<BoardBackground column={672} />)
    for (const layer of hardware(container)) {
      expect(classes(layer)).toMatch(/\bhidden\b/)
      expect(classes(layer)).toMatch(/\blg:block\b/)
    }
  })

  it('sizes the hardware from the gutter, never from a fixed width', () => {
    // A flat 16vw passed at 1440 and FAILED on /help at 1024 with 33 glyphs
    // over the right-hand layer: a fixed width cannot know how wide the column
    // it must avoid is.
    //
    // Asserted on the function, not the rendered element — jsdom rejects a
    // clamp() width outright and getAttribute('style') comes back null, so the
    // component-level version of this test could only pass vacuously.
    expect(hardwareWidth(768)).toContain('100% - 768px')
    expect(hardwareWidth(672)).toContain('100% - 672px')
    // Collapses to nothing rather than overlapping when the gutter runs out.
    expect(hardwareWidth(768)).toMatch(/^clamp\(0px,/)
    // And is still capped, so a very wide screen does not hand half the page
    // over to artwork.
    expect(hardwareWidth(0)).toMatch(/16vw\)$/)
  })

  it('scrims the readable column, and only when there is one', () => {
    const withColumn = render(<BoardBackground column={672} />)
    const scrim = withColumn.container.querySelector('[data-scrim]')
    expect(scrim).not.toBeNull()
    // Read the raw attribute: jsdom's CSS parser drops a gradient containing
    // calc(), so scrim.style.background comes back as an empty string and an
    // assertion against it passes or fails for the wrong reason.
    expect(scrim.getAttribute('style')).toContain(String(SCRIM_ALPHA))

    // The builder covers its viewport in opaque panels and has no prose column,
    // so a scrim there would dim the board for nothing.
    const bare = render(<BoardBackground />)
    expect(bare.container.querySelector('[data-scrim]')).toBeNull()
  })

  it('sizes the scrim to the column it protects', () => {
    const narrow = render(<BoardBackground column={672} />)
    const wide = render(<BoardBackground column={768} />)
    const width = (r) => parseInt(r.container.querySelector('[data-scrim]').style.width, 10)
    expect(width(wide)).toBe(width(narrow) + 96)
  })

  it('knocks the brightest trace far enough down to clear AA under text', () => {
    // --faint needs the brightest pixel behind it at or below ~15% gold over
    // ground. The heaviest trace runs at 0.68, so the scrim has to take it to
    // 0.68 * (1 - SCRIM_ALPHA) <= 0.15. Anything less and the board wins.
    const { container } = render(<BoardBackground column={672} />)
    const heaviest = Number(
      container.querySelector('[data-trace="power"]').getAttribute('stroke-opacity'),
    )
    expect(heaviest * (1 - SCRIM_ALPHA)).toBeLessThanOrEqual(0.15)
  })

  it('never uses the brand orange', () => {
    // accentIsBrandOnly.test.js guards four wordmark sites by class name and
    // cannot see a literal rgba() in a style attribute — which is exactly how
    // Backdrop carried #F26B3A for months without failing anything.
    const { container } = render(<BoardBackground column={672} />)
    expect(container.innerHTML).not.toMatch(/--accent\b|#F26B3A|242,\s*107,\s*58/i)
  })
})
