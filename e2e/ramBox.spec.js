import { test, expect } from '@playwright/test'
import { generateBuild } from './helpers.js'
// Imported rather than retyped as literals: the invariant these prove is
// "whatever the module declares, the browser honours it", so a tuning change
// should move the test with the source instead of failing it.
import { BLADES, FIN_ROW_HEIGHT, CONTACT_HEIGHT } from '../src/lib/ramBoxGeometry.js'

// jsdom computes no layout and applies no transform, so the unit tests can
// prove the STATE flips and nothing more. Whether the stick actually rises,
// whether the clips actually rock, and whether the page stays still while it
// happens can only be measured in a real browser.

const BOX = '[data-ram-box]'

// ⚠️ Poll, never read once. The lift is a 200ms transition, and a computed
// transform read the instant `data-lifted` flips is still the START of the
// animation — every one of these assertions failed first time against a
// perfectly working page, reporting the identity matrix.
const settles = (locator, fn) => expect.poll(() => locator.evaluate(fn), { timeout: 2000 })

test.describe('a seated box unseats on hover', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForSelector(BOX)
  })

  test('lifts the stick clear of its slot', async ({ page }) => {
    const box = page.locator(BOX).first()
    await expect(box).toHaveAttribute('data-lifted', 'false')

    const before = await box.locator('[data-contacts]').evaluate(
      (el) => getComputedStyle(el.parentElement).transform,
    )
    expect(before).toBe('none')

    await box.hover()
    await expect(box).toHaveAttribute('data-lifted', 'true')

    // 8px up. Asserted on the matrix rather than a class, because a Tailwind
    // class that has been purged still appears in the DOM.
    await settles(
      box.locator('[data-contacts]'),
      (el) => getComputedStyle(el.parentElement).transform,
    ).toBe('matrix(1, 0, 0, 1, 0, -8)')
  })

  test('breaks the connection but keeps the bar lit', async ({ page }) => {
    // The two jobs gold does in this system come apart here. The lit bar tracks
    // ATTENTION and stays on; the contacts track CONNECTION and go cold,
    // because the stick is physically out of its socket. Crossing these makes
    // the interaction stop meaning anything.
    const box = page.locator(BOX).first()
    await expect(box.locator('[data-contacts]')).toHaveAttribute('data-contacts', 'live')

    await box.hover()
    await expect(box.locator('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')
    await expect(box.locator('[data-bar]')).toHaveAttribute('data-bar', 'lit')
  })

  test('rocks both retention clips outward', async ({ page }) => {
    const box = page.locator(BOX).first()
    await box.hover()
    // ±26°: cos 26 = 0.8988, sin 26 = 0.4384, opposite signs per side.
    await expect
      .poll(
        () =>
          box
            .locator('[data-clip]')
            .evaluateAll((els) => els.map((e) => getComputedStyle(e).transform)),
        { timeout: 2000 },
      )
      .toEqual([
        'matrix(0.898794, -0.438371, 0.438371, 0.898794, 0, 0)',
        'matrix(0.898794, 0.438371, -0.438371, 0.898794, 0, 0)',
      ])
  })

  test('moves nothing else on the page', async ({ page }) => {
    // ⚠️ The reason the socket floats behind the stick instead of sitting in
    // the flow. An in-flow socket adds 15px on every hover, so the whole page
    // twitches whenever the pointer crosses a card — which reads as a bug
    // rather than as a mechanism.
    const snap = () =>
      page.evaluate(() => ({
        boxes: [...document.querySelectorAll('[data-ram-box]')]
          .slice(1)
          .map((b) => Math.round(b.getBoundingClientRect().top)),
        docHeight: document.documentElement.scrollHeight,
      }))

    // Settle first: the entry screen runs a fade-and-rise on mount, and a
    // baseline taken during it would drift for reasons that have nothing to do
    // with hovering.
    await page.waitForTimeout(600)
    const rest = await snap()

    await page.locator(BOX).first().hover()
    await expect(page.locator(BOX).first()).toHaveAttribute('data-lifted', 'true')
    await page.waitForTimeout(300)
    expect(await snap()).toEqual(rest)
  })

  test('answers the keyboard, not just the mouse', async ({ page }) => {
    // ⚠️ Focus the BUTTON, not the box. The caller wraps this component in the
    // interactive element — <button><RamBox/></button> — so focus lands on an
    // ancestor and does not travel downward. An onFocus prop on the box's own
    // root looked right and fired never; the component binds to its closest
    // focusable ancestor instead, and this is the test that pins that down.
    const box = page.locator(BOX).first()
    await box.evaluate((el) => el.closest('button').focus())
    await expect(box).toHaveAttribute('data-lifted', 'true')
    await expect(box.locator('[data-contacts]')).toHaveAttribute('data-contacts', 'cold')

    await box.evaluate((el) => el.closest('button').blur())
    await expect(box).toHaveAttribute('data-lifted', 'false')
  })

  test('every entry slot is seated', async ({ page }) => {
    // Unconditionally, and that is a deliberate reversal — seating briefly
    // tracked content and left a first-time visitor looking at dead hardware.
    const seated = await page.locator(BOX).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-seated')),
    )
    expect(seated.length).toBeGreaterThan(0)
    expect(seated.every((s) => s === 'true')).toBe(true)
  })
})

// ⚠️ These two guard OPPOSING decisions, and that opposition is the design.
//
// Blades are positioned in PERCENTAGES so that a narrow box keeps all five —
// fixed pixels were prototyped and a 150px box kept two. Fins and contacts are
// FIXED PIXELS so that a tall box is the same physical part with a longer body
// rather than a scaled-up drawing. A change that "unifies" the two units
// breaks one or the other, and jsdom computes no layout, so this is the only
// place either can be measured.
//
// ⚠️ Counting [data-blade] elements proves NOTHING: BLADES.map() renders five
// spans at every width, so the count is five even under a pixel implementation
// that has pushed three of them off the box. Position is the falsifiable part.
test.describe('the silhouette holds its geometry at any size', () => {
  // ⚠️ offsetLeft/offsetWidth, not getBoundingClientRect. Blades carry
  // skewX(±20deg), which widens the client rect by up to height*tan(20°) ≈ 6px
  // and would drown the very thing being measured. The offset pair reports the
  // untransformed layout box.
  const geometry = (page) =>
    page.locator(BOX).evaluateAll((boxes) =>
      boxes.map((box) => {
        const blades = [...box.querySelectorAll('[data-blade]')]
        const row = blades[0]?.offsetParent
        return {
          rowWidth: row?.offsetWidth ?? 0,
          blades: blades.map((b) => ({ left: b.offsetLeft, width: b.offsetWidth })),
        }
      }),
    )

  test('holds every blade at its proportional place however narrow the box gets', async ({ page }) => {
    // The entry screen rather than a generated build: it carries RamBoxes at
    // mount, so a width sweep costs nothing extra. One test doing generateBuild
    // AND eight viewport changes is what ran topBar.spec.js past the 30s
    // default and read as a layout bug — keep the two apart.
    await page.goto('/')
    await page.waitForSelector(BOX)

    const widths = [1440, 1024, 768, 480, 320]
    const seen = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      seen.push({ width, boxes: await geometry(page) })
    }

    const boxCount = seen[0].boxes.length
    expect(boxCount).toBeGreaterThan(0)

    // ⚠️ The sweep's OWN premise. The column caps at 640px, so 1440/1024/768 all
    // produce an identical box and only the last two viewports actually narrow
    // it — measured 640, 640, 640, 448, 288. Without this, a layout change that
    // pinned the column would leave the test measuring one width five times and
    // still reporting green.
    const rowWidths = new Set(seen.flatMap((s) => s.boxes.map((b) => b.rowWidth)))
    expect(rowWidths.size, `distinct box widths exercised (saw ${[...rowWidths].join(', ')})`).toBeGreaterThanOrEqual(3)

    for (const { width, boxes } of seen) {
      expect(boxes.length, `boxes rendered at ${width}px`).toBe(boxCount)

      for (const [i, box] of boxes.entries()) {
        expect(box.blades.length, `blades on box ${i} at ${width}px`).toBe(BLADES.length)
        expect(box.rowWidth, `fin row width on box ${i} at ${width}px`).toBeGreaterThan(0)

        for (const [j, blade] of box.blades.entries()) {
          // offsetLeft/offsetWidth are integers, so allow a rounding pixel
          // either way and nothing more. A pixel implementation misses by
          // hundreds at 320px, not by ones.
          const expectedLeft = (box.rowWidth * BLADES[j].left) / 100
          const expectedWidth = (box.rowWidth * BLADES[j].width) / 100
          expect(Math.abs(blade.left - expectedLeft), `blade ${j} left on box ${i} at ${width}px`).toBeLessThanOrEqual(1.5)
          expect(Math.abs(blade.width - expectedWidth), `blade ${j} width on box ${i} at ${width}px`).toBeLessThanOrEqual(1.5)
        }
      }
    }
  })

  test('holds fins and contacts at a fixed height while the bodies stretch', async ({ page }) => {
    await generateBuild(page)

    const parts = await page.locator(BOX).evaluateAll((boxes) =>
      boxes.map((box) => ({
        boxHeight: Math.round(box.getBoundingClientRect().height),
        finRow: box.querySelector('[data-blade]')?.offsetParent?.offsetHeight ?? null,
        contacts: box.querySelector('[data-contacts]')?.offsetHeight ?? null,
      })),
    )

    expect(parts.length).toBeGreaterThan(0)

    // ⚠️ The PREMISE, asserted rather than assumed. "Every contact strip is the
    // same height" is trivially true if every box is also the same height, and
    // the whole claim is about what happens when they are not.
    expect(new Set(parts.map((p) => p.boxHeight)).size).toBeGreaterThan(1)

    expect(parts.map((p) => p.finRow)).toEqual(parts.map(() => FIN_ROW_HEIGHT))
    expect(parts.map((p) => p.contacts)).toEqual(parts.map(() => CONTACT_HEIGHT))
  })
})
