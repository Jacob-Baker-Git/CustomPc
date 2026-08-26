import { test, expect, devices } from '@playwright/test'
import { generateBuild } from './helpers.js'

// Phone-width layout guards.
//
// ⚠️ Every existing width sweep in this suite stops at the desktop grid:
// ramBox.spec.js measures "the body never outgrows the stick" at 1440/1366/
// 1280/1024 only, because that is where the three-column grid is live. Below
// 1024 the grid collapses to one column and NOTHING measured it — which is
// exactly where these two regressions were sitting.
//
// jsdom computes no layout, so none of this is reachable from the unit suite.
const PHONES = [320, 360, 375, 390, 414]

// ⚠️ The band nothing owned. ramBox.spec.js starts at 1024 ("at and above
// 1024px the grid is live"); topBar.spec.js is the only other sweep and it
// measures the header alone. So 768–1023 — every tablet in portrait, and a
// large phone in landscape — had no structural guard on the build page at all.
const TABLETS = [768, 834, 1024]

// ⚠️ Bounding rects lie about inline elements. A wrapped <span> reports the
// UNION of its line boxes — left edge of the last line to right edge of the
// first — so an inline that wraps appears to overlap every sibling on both
// lines. Measuring the "Best next move" sentence that way reported seven
// overlaps, all of them false. getClientRects() per line box is the honest
// measurement, and it is what the token guard below uses.

test.describe('the 3D viewport chrome fits a phone', () => {
  // Both controls are absolutely positioned children of .area-viz pinned to
  // bottom-3 — one left-3, one right-3 — so nothing in the layout stops them
  // sliding into each other as the panel narrows. Measured before the fix:
  // 72.8px of overlap at 320, 32.8px at 375, 2.8px at 390.
  test('never laps the drag hint over the case toggle', async ({ page }) => {
    // generateBuild plus a viewport sweep is the combination that ran
    // topBar.spec.js past the 30s default and read as a layout bug.
    test.setTimeout(90_000)
    await generateBuild(page)

    const hint = page.locator('[data-viewport-hint]')
    const toggle = page.getByRole('button', { name: /(see-through|solid) case/i })

    for (const width of [...PHONES, ...TABLETS]) {
      await page.setViewportSize({ width, height: 812 })

      // ⚠️ The PREMISE, asserted rather than assumed. "These two do not
      // overlap" passes trivially if one of them stopped rendering — hiding
      // the hint below sm would turn this test green while deleting the very
      // thing it exists to place.
      await expect(hint, `drag hint visible at ${width}px`).toBeVisible()
      await expect(toggle, `case toggle visible at ${width}px`).toBeVisible()

      const a = await hint.boundingBox()
      const b = await toggle.boundingBox()
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)

      // Overlapping on one axis alone is not a collision: side by side they
      // share rows, stacked they share columns. Both at once is the bug.
      const collides = overlapX > 0.5 && overlapY > 0.5
      expect(
        collides,
        `drag hint vs case toggle at ${width}px — overlap ${overlapX.toFixed(1)}x${overlapY.toFixed(1)}px`,
      ).toBe(false)

      // Both must stay inside the panel they belong to, or "no overlap" could
      // be bought by shoving one of them off the frame.
      const panel = await page.locator('.area-viz').boundingBox()
      for (const [name, r] of [['hint', a], ['toggle', b]]) {
        expect(r.x, `${name} left edge inside panel at ${width}px`).toBeGreaterThanOrEqual(panel.x - 0.5)
        expect(r.x + r.width, `${name} right edge inside panel at ${width}px`).toBeLessThanOrEqual(panel.x + panel.width + 0.5)
        expect(r.y + r.height, `${name} bottom inside panel at ${width}px`).toBeLessThanOrEqual(panel.y + panel.height + 0.5)
      }
    }
  })
})

test.describe('numbers do not break across lines', () => {
  // "+£10" rendered as "+" on one line and "£10" on the next. Nothing in the
  // markup asks for that break — UAX#14 simply permits one between PLUS SIGN
  // and POUND SIGN, both class PR, and a narrow column takes it. TELEMETRY
  // ("font-mono tabular-nums") carried no wrapping rule at all.
  test('keeps every telemetry token on one line at phone widths', async ({ page }) => {
    test.setTimeout(90_000)
    await generateBuild(page)

    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 812 })

      const { split, checked, sawPrice } = await page.evaluate(() => {
        const vis = (el) =>
          el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })
        const split = []
        let checked = 0
        let sawPrice = false
        document.querySelectorAll('[class*="tabular-nums"]').forEach((el) => {
          if (!vis(el)) return
          const text = (el.textContent || '').trim()
          // Only single tokens: a multi-word string is allowed to wrap at its
          // spaces, and asserting otherwise would fight real prose.
          if (!text || /\s/.test(text)) return
          checked += 1
          if (text.includes('£')) sawPrice = true
          // One rect per line box. Fragments sharing a top edge are one visual
          // run split by a font boundary, which is not a wrap.
          const tops = [...el.getClientRects()].map((r) => Math.round(r.top))
          if (new Set(tops).size > 1) split.push(text)
        })
        return { split, checked, sawPrice }
      })

      // ⚠️ Premise again: with no tokens on screen this loop asserts nothing.
      // A build at 1600 always renders prices, so both of these are real.
      expect(checked, `telemetry tokens measured at ${width}px`).toBeGreaterThan(0)
      expect(sawPrice, `at least one £ token measured at ${width}px`).toBe(true)
      expect(split, `tokens broken across lines at ${width}px`).toEqual([])
    }
  })
})

test.describe('nothing pushes the page sideways', () => {
  test('keeps the document at the viewport width on every phone', async ({ page }) => {
    test.setTimeout(90_000)
    await generateBuild(page)

    for (const width of [...PHONES, ...TABLETS]) {
      await page.setViewportSize({ width, height: 812 })
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth, `document scroll width at ${width}px`).toBeLessThanOrEqual(clientWidth)
    }
  })
})

test.describe('the zoom hint names the gesture the device actually has', () => {
  // "scroll to zoom" is a mouse instruction. A finger has no scroll wheel, and
  // after the row fix above the hint takes a whole line to itself on a phone —
  // so it was spending real estate to tell touch users to do something they
  // cannot do. The verb swaps on (pointer: coarse), in CSS rather than JS
  // because this screen is pre-rendered and a matchMedia read at render time
  // would bake one verb in and flip it on hydration.
  const readVerbs = async (context) => {
    const page = await context.newPage()
    await generateBuild(page)
    const shown = await page.locator('[data-viewport-hint]').evaluate((el) => ({
      // innerText, not textContent: both verbs are always in the DOM and only
      // one is displayed, which is the entire thing being asserted.
      sentence: el.innerText.replace(/\s+/g, ' ').trim(),
      visible: [...el.querySelectorAll('[data-zoom-verb]')]
        .filter((s) => s.checkVisibility())
        .map((s) => s.dataset.zoomVerb),
    }))
    await context.close()
    return shown
  }

  test('says pinch on a touch device and scroll on a mouse', async ({ browser }) => {
    test.setTimeout(90_000)

    const touch = await readVerbs(await browser.newContext({ ...devices['iPhone 13'] }))
    const mouse = await readVerbs(await browser.newContext({ viewport: { width: 1440, height: 900 } }))

    // ⚠️ The mutation this is really guarding. If the arbitrary variant ever
    // stops compiling — a Tailwind upgrade, a content-scan change, someone
    // moving it into `screens` without restarting the dev server — it emits no
    // CSS and the failure mode is FAILING OPEN: neither span is hidden and the
    // hint reads "scrollpinch to zoom". Asserting the verb alone would not
    // catch that, because the right verb is still on screen. Counting them does.
    expect(touch.visible, 'verbs displayed on a touch device').toEqual(['pinch'])
    expect(mouse.visible, 'verbs displayed with a mouse').toEqual(['scroll'])

    expect(touch.sentence).toBe('Drag to rotate · pinch to zoom')
    expect(mouse.sentence).toBe('Drag to rotate · scroll to zoom')
  })
})

test.describe('the body never outgrows the stick below the desktop grid', () => {
  // ramBox.spec.js proves this at 1440/1366/1280/1024, where the three-column
  // grid is live and the left column is 1fr of three. Below 1024 the grid
  // collapses to one column — a different layout, and one that had never been
  // measured. Same invariant, the other side of the breakpoint.
  test('keeps body, fins and contacts the same width at tablet and phone widths', async ({ page }) => {
    test.setTimeout(120_000)
    await generateBuild(page)

    const seen = []
    for (const width of [...TABLETS, ...PHONES]) {
      await page.setViewportSize({ width, height: 900 })

      const measured = await page.locator('[data-ram-box]').evaluateAll((boxes) =>
        boxes.map((box) => {
          const finRow = box.querySelector('[data-blade]')?.offsetParent
          const contacts = box.querySelector('[data-contacts]')
          const body = contacts?.previousElementSibling?.querySelector('.flex-1')
          const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null)
          return {
            label: (box.textContent || '').trim().slice(0, 18),
            fins: w(finRow),
            contacts: w(contacts),
            body: w(body),
          }
        }),
      )

      expect(measured.length, `boxes rendered at ${width}px`).toBeGreaterThan(0)
      for (const m of measured) {
        expect(m.body, `body vs contacts on "${m.label}" at ${width}px`).toBe(m.contacts)
        expect(m.body, `body vs fins on "${m.label}" at ${width}px`).toBe(m.fins)
      }
      seen.push(measured[0].body)
    }

    // ⚠️ The sweep's own premise, the same one ramBox.spec.js asserts: if the
    // column were pinned, this would be one width measured eight times and
    // would still report green.
    expect(new Set(seen).size, `distinct box widths exercised (saw ${seen.join(', ')})`).toBeGreaterThanOrEqual(3)
  })
})

test.describe('the 3D panel is not a scroll trap on a phone', () => {
  // three.js OrbitControls sets touch-action: none on its canvas when it
  // connects, which hands it EVERY touch gesture. On a phone that canvas is
  // ~42% of the screen height (277px of 664 on an iPhone 13), so nearly half
  // the build page was a region where a finger drag rotated the model and the
  // page simply would not scroll. Nothing signals that; it just feels stuck.
  //
  // index.css overrides it to pan-y under (pointer: coarse): the browser gets
  // the vertical axis back, while a horizontal drag still rotates and two
  // fingers still dolly, because neither is covered by pan-y.

  // ⚠️ Wait for the CONTROL to connect, not for the model to load.
  //
  // Waiting on the "Assembling 3D" fallback meant waiting up to 90s for WebGL,
  // twice, which blew a 180s budget and made this flaky. It was also the wrong
  // condition: what has to be true is that OrbitControls is intercepting, and
  // its tell is the inline touch-action it writes on connect. Without this the
  // swipe would sail through an unclaimed canvas and pass while proving nothing.
  // ⚠️ OrbitControls attaches to the r3f CONTAINER DIV, two levels above the
  // canvas — not to the canvas. Its tell is the inline touch-action: none it
  // writes there on connect, and that inline value survives our stylesheet
  // override (which changes the computed value, not the inline one), so it
  // stays a clean signal.
  //
  // This premise is not decoration. Before it existed the swipe sailed through
  // an unclaimed canvas and passed while proving nothing — the test went green
  // on exactly the runs where the control had not connected yet.
  const orbitControlsAttached = async (page) => {
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              [...document.querySelectorAll('.area-viz, .area-viz *')].some(
                (el) => el.style.touchAction === 'none',
              ),
          ),
        { timeout: 30_000 },
      )
      .toBe(true)
    return canvas
  }

  test('lets a finger scroll the page over the canvas', async ({ browser }) => {
    test.setTimeout(120_000)
    const ctx = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await ctx.newPage()
    await generateBuild(page)
    // The canvas itself is not needed here — the assertion below reads the
    // whole subtree, which is how the browser evaluates this.
    await orbitControlsAttached(page)

    // Our stylesheet beats the inline style it just wrote. !important is what
    // makes that true, and this is the assertion that proves it.
    // Every element in the subtree, because the browser intersects touch-action
    // across ancestors: one `none` left anywhere above the canvas still blocks
    // the page, which is precisely the bug this rule was written wrong for once.
    const effective = await page.evaluate(() =>
      [...document.querySelectorAll('.area-viz, .area-viz *')]
        .map((el) => getComputedStyle(el).touchAction)
        .filter((v) => v !== 'pan-y'),
    )
    expect(effective, 'elements in the 3D panel not resolving to pan-y').toEqual([])

    // ⚠️ There is deliberately no synthetic swipe here, and that is a reversal.
    //
    // A CDP touch-drag WAS written, and it did prove the fix — 305px of page
    // scroll over the canvas, measured. But it could not be made stable: on a
    // heavy WebGL scene in headless the main thread stalls after a drag, and a
    // following evaluate() hangs until the test times out. It failed 2 runs in 3
    // for reasons that had nothing to do with the app.
    //
    // The assertion above is not a weaker substitute for it. touch-action IS the
    // browser contract that decides this, the intersection across the subtree is
    // exactly how the browser evaluates it, and it is what catches the bug that
    // actually happened: the first version of the CSS rule targeted only the
    // canvas, the r3f container above it kept `none`, and the page stayed stuck.
    // That version fails this assertion instantly and deterministically.
    await ctx.close()
  })

  test('leaves the canvas claiming every gesture on desktop', async ({ browser }) => {
    // ⚠️ The other side. A blanket override would also strip the canvas on
    // desktop, where `none` is what stops a trackpad two-finger swipe scrolling
    // the page out from under a rotate. Asserting the exact inline value three
    // writes would be testing three; the invariant that matters here is only
    // that the coarse-pointer rule did not leak.
    test.setTimeout(120_000)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await generateBuild(page)
    const canvas = await orbitControlsAttached(page)
    expect(canvas, 'canvas present').toBeTruthy()
    const anyPanY = await page.evaluate(() =>
      [...document.querySelectorAll('.area-viz, .area-viz *')].some(
        (el) => getComputedStyle(el).touchAction === 'pan-y',
      ),
    )
    expect(anyPanY, 'the coarse-pointer rule leaked to a fine pointer').toBe(false)
    await ctx.close()
  })
})
