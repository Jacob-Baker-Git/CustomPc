import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Reads the real palette out of index.css rather than restating it, for the same
// reason cspHeaders.test.js reads public/_headers: a copy of the values here
// would pass happily while the shipped stylesheet said something else.
//
// text-faint used to fail WCAG AA everywhere it appeared (3.17–3.91:1) across
// 31 call sites. It was fixed at the token rather than per component, so this is
// the guard that keeps it fixed.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function cssVar(name) {
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css)
  if (!m) throw new Error(`--${name} not found in index.css, or is no longer a plain hex colour`)
  return m[1]
}

// WCAG 2.1 relative luminance. Channel values are linearised before weighting —
// averaging the raw sRGB bytes instead is the classic way to get this wrong.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)]
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

const BACKGROUNDS = ['ground', 'surface', 'surface-2', 'gold-soft']
// Every token that renders as body text somewhere in the app. The metals and the
// signal trio are all used as text — none of them were covered before, and two
// candidate values (true copper #B87333 at 4.00, and a redder error #D9453C at
// 3.52) FAILED here and were changed because of it. That is what this is for.
const TEXT = ['ink', 'muted', 'faint', 'accent', 'brass', 'gold', 'tech', 'good', 'ok', 'bad']

const AA_BODY = 4.5

describe('palette contrast (src/index.css)', () => {
  // The method is only trustworthy if it reproduces figures measured
  // independently, so anchor it on two before touching the assertions.
  it('computes contrast correctly against known reference values', () => {
    expect(contrast('#6B7280', '#22252C')).toBeCloseTo(3.17, 1) // the old faint
    expect(contrast('#99A0AB', '#0F1114')).toBeCloseTo(7.18, 1) // muted on ground
  })

  // 10-11px type, so the large-text exemption (3:1) never applies here.
  for (const text of TEXT) {
    for (const bg of BACKGROUNDS) {
      it(`text-${text} on bg-${bg} meets WCAG AA for body text`, () => {
        expect(contrast(cssVar(text), cssVar(bg))).toBeGreaterThanOrEqual(AA_BODY)
      })
    }
  }

  // Fixing the contrast must not flatten the palette into one grey. If faint
  // ever reaches muted, every "this is secondary" cue on the site is lost.
  it('keeps ink brighter than muted, and muted brighter than faint', () => {
    const l = (n) => luminance(cssVar(n))
    expect(l('ink')).toBeGreaterThan(l('muted'))
    expect(l('muted')).toBeGreaterThan(l('faint'))
  })
})
