import { test, expect } from '@playwright/test'

// The board is the one part of this UI that no unit test can judge. jsdom
// computes no layout, and paletteContrast.test.js measures text against a FLAT
// token colour — a pattern is invisible to it by construction.
//
// What has to hold, and why:
//
//   --faint (#878E9C) on a full-strength gold pad measures 1.46:1, and --ink
//   on the same pad measures 1.95:1. Nothing readable can sit on solid gold at
//   any token we own. So the guarantee is geometric rather than chromatic:
//
//     1. no glyph ever overlaps a hardware layer — that is where every solid
//        gold pad lives, and it is the failure that actually blinds a reader
//     2. every glyph outside an opaque surface sits inside the scrim's flat
//        core, where the heaviest trace is knocked to 0.68 * 0.18 = 0.12
//
// A flat 16vw hardware width passed (1) at 1440 and FAILED it at 1024 on /help
// with 33 overlapping nodes, which is why the width is derived from the gutter.
// Keep this matrix wide: the bug lived only at one column width and one
// viewport.

const SCRIM_FADE = 100

// ⚠️ Glyph boxes, NOT element boxes. The footer disclaimer is a centred,
// full-width <p>: its block box spans the whole viewport while its text
// occupies ~400px in the middle. Measuring the block box reports a collision
// that a reader would never see, and one false positive here is enough to make
// the whole check get ignored.
const probe = ({ fade }) => {
  const opaqueBacked = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n)
      const m = s.backgroundColor.match(/rgba?\(([^)]+)\)/)
      if (m) {
        const p = m[1].split(',').map(Number)
        if (p.length < 4 || p[3] > 0.9) return true
      }
      if (s.backgroundImage !== 'none') return true
    }
    return false
  }

  const glyphRects = (el) => {
    const out = []
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue
      const r = document.createRange()
      r.selectNodeContents(node)
      out.push(...[...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0))
    }
    return out
  }

  const scrim = document.querySelector('[data-scrim]')
  const sr = scrim && scrim.getBoundingClientRect()
  const core = sr ? { left: sr.left + fade, right: sr.right - fade } : null
  const hw = [...document.querySelectorAll('[data-board-layer="hardware"]')]
    .map((h) => h.getBoundingClientRect())
    .filter((r) => r.width > 0)

  const outsideCore = []
  const onHardware = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[data-board]') || !el.textContent.trim()) continue
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') continue
    if (opaqueBacked(el)) continue
    for (const r of glyphRects(el)) {
      const label = `${el.tagName}:${el.textContent.trim().slice(0, 30)}`
      if (core && (r.left < core.left - 0.5 || r.right > core.right + 0.5)) {
        outsideCore.push(`${label} @${Math.round(r.left)}-${Math.round(r.right)}`)
      }
      if (hw.some((h) => r.left < h.right && r.right > h.left && r.top < h.bottom && r.bottom > h.top)) {
        onHardware.push(`${label} @${Math.round(r.left)}-${Math.round(r.right)}`)
      }
    }
  }
  return { outsideCore, onHardware, hardware: hw.length }
}

const ROUTES = ['/', '/help', '/glossary', '/parts']
const WIDTHS = [1024, 1152, 1280, 1440, 1920]

test.describe('the board never gets under readable text', () => {
  for (const width of WIDTHS) {
    for (const path of ROUTES) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(path)
        await page.waitForSelector('[data-board]')

        const { outsideCore, onHardware } = await page.evaluate(probe, { fade: SCRIM_FADE })
        expect(onHardware, `glyphs over a solid-gold hardware layer`).toEqual([])
        expect(outsideCore, `glyphs outside the scrim's flat core`).toEqual([])
      })
    }
  }

  test('drops the hardware layers entirely on a phone', async ({ page }) => {
    // Below lg the column IS the viewport — there is no gutter to put an
    // edge-pinned layer in that is not under the text.
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('[data-board-layer="hardware"]')].map(
        (h) => h.getBoundingClientRect().width,
      ),
    )
    expect(widths.every((w) => w === 0)).toBe(true)
  })

  test('keeps a real gap between the hardware and the column', async ({ page }) => {
    // Touching is already a failure: a gold pad half a pixel off a descender is
    // as unreadable as one behind it. This is the assertion that would catch a
    // regression to a fixed width before it reaches a glyph.
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/help')
    const gap = await page.evaluate(() => {
      const hw = [...document.querySelectorAll('[data-board-layer="hardware"]')]
        .map((h) => h.getBoundingClientRect())
        .filter((r) => r.width > 0)
      const main = document.querySelector('main').getBoundingClientRect()
      return Math.min(main.left - hw[0].right, hw[1].left - main.right)
    })
    expect(gap).toBeGreaterThanOrEqual(16)
  })

  test('strokes stay hairlines however far the drawing is scaled', async ({ page }) => {
    // preserveAspectRatio="slice" runs the full-bleed layer at 2.28x on a
    // 1412x958 viewport. Without vector-effect the tuned 0.6/1/2 widths render
    // at 1.4/2.3/4.6 screen px — a heavier board on a bigger monitor, and more
    // bright pixels under the same text than the scrim was sized for.
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    const widths = await page.evaluate(() =>
      ['signal', 'outline', 'power'].map((k) => {
        const g = document.querySelector(`[data-trace="${k}"]`)
        return [getComputedStyle(g).strokeWidth, getComputedStyle(g).vectorEffect]
      }),
    )
    expect(widths).toEqual([
      ['0.6px', 'non-scaling-stroke'],
      ['1px', 'non-scaling-stroke'],
      ['2px', 'non-scaling-stroke'],
    ])
  })
})
