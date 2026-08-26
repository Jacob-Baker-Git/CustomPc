import { test, expect } from '@playwright/test'
import { generateBuild, openTab } from './helpers.js'

// The assertion e2e/boardBackground.spec.js does not make. That spec covers
// ROUTES = ['/', '/help', '/glossary', '/parts'] and no builder tab, which is
// exactly why 28 glyph runs shipped sitting on bare board.
//
// The builder has NO SCRIM — BuilderScreen renders <BoardBackground /> with no
// column on purpose — so the contract here is different from the one over
// there. There it is "every glyph is inside the scrim's flat core". Here it is
// "every glyph has something painted behind it".

const TABS = ['build', 'performance', 'peripherals', 'summary']

// 1024 is where the hardware layers first paint (`hidden lg:block`). 1920
// because hardwareWidth's clamp grows the layers with the gutter, so clearing
// them at 1257 does not mean clearing them wide. 1257 is where the defect was
// first measured.
const WIDTHS = [1024, 1257, 1440, 1920]

async function offenders(page) {
  return page.evaluate(() => {
    const layers = [...document.querySelectorAll('[data-board-layer="hardware"]')]
      .map((l) => l.getBoundingClientRect())
      .filter((b) => b.width > 0)
    if (layers.length === 0) return { checked: 0, over: [] }

    // ⚠️ sr-only text is clipped to a 1px box and STILL returns a client rect.
    // BuilderScreen has one. Counting it adds a phantom offender to every tab.
    const hidden = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n)
        if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return true
        if ((s.clipPath && s.clipPath !== 'none') || (s.clip && s.clip !== 'auto')) return true
      }
      return false
    }

    // ⚠️ Counts background-IMAGE as well as background-colour. RamBox paints its
    // body with a gradient, so a colour-only check calls every DIMM-shaped
    // panel on the page bare board — that alone inflated two tabs fivefold.
    //
    // ⚠️ Stops at body. html/body backgrounds paint BELOW the -z-10 board, so
    // treating them as protection reports zero collisions where there are many.
    const covered = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n)
        if (s.backgroundImage && s.backgroundImage !== 'none') return true
        const m = s.backgroundColor.match(/rgba?\(([^)]+)\)/)
        if (m && (m[1].split(',').map(Number)[3] ?? 1) > 0.5) return true
      }
      return false
    }

    const over = []
    let checked = 0
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim() || hidden(n.parentElement)) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      // Per-rect, never the union: a union rect over a wrapped inline spans
      // gutters the glyphs never touch.
      for (const b of range.getClientRects()) {
        if (b.width < 3 || b.height < 3) continue
        checked += 1
        const hits = layers.some(
          (L) => b.left < L.right && b.right > L.left && b.top < L.bottom && b.bottom > L.top,
        )
        if (hits && !covered(n.parentElement)) over.push(n.textContent.trim().slice(0, 60))
      }
    }
    return { checked, over }
  })
}

test.describe('the builder never puts text on bare board', () => {
  for (const width of WIDTHS) {
    test(`every tab at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await generateBuild(page)

      const failures = []
      for (const tab of TABS) {
        await openTab(page, tab)
        await page.waitForTimeout(400)
        const { checked, over } = await offenders(page)
        // A control: if nothing was measured the assertion below is vacuous.
        expect(checked, `${tab} rendered no measurable text`).toBeGreaterThan(20)
        if (over.length) {
          failures.push(`${tab}: ${over.length} -> ${[...new Set(over)].slice(0, 6).join(' | ')}`)
        }
      }
      expect(failures.join('\n')).toBe('')
    })
  }
})
