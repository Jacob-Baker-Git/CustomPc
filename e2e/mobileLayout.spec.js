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

// ⚠️ On a coarse pointer the 3D panel does not load until it is asked to —
// it is 11 MB of models and a phone should not spend that unbidden. So every
// touch test that needs the canvas, or the chrome that floats over it, has to
// opt in first. Fine-pointer contexts still get it immediately and must not
// call this.
const optIntoThe3D = async (page) => {
  const button = page.getByRole('button', { name: /view in 3d/i })
  await expect(button, 'the 3D opt-in button on a touch device').toBeVisible()
  await button.click()
}

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
    // The hint lives over the canvas, so on touch it only exists once loaded.
    if (await page.getByRole('button', { name: /view in 3d/i }).count()) {
      await optIntoThe3D(page)
    }
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
    await optIntoThe3D(page)
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

test.describe('the 3D view is not downloaded before it is asked for', () => {
  // Opening the builder pulls the lazy BuildCanvas chunk plus every model for
  // the selected parts: 11 MB of GLB, 7.7 of it the motherboard. On a phone that
  // is the largest thing the site does, and it happened before anyone asked.
  //
  // Shrinking it was investigated and declined — motherboard.glb is a triangle
  // soup that floors at 57% of its triangles under decimation and its textures
  // are only 7% of the file. So the lever is WHEN it loads.
  const watchModels = (page) => {
    const seen = []
    page.on('request', (r) => {
      if (r.url().endsWith('.glb')) seen.push(r.url().split('/').pop())
    })
    return seen
  }

  test('fetches nothing on a phone until the button is tapped', async ({ browser }) => {
    test.setTimeout(120_000)
    const ctx = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await ctx.newPage()
    const models = watchModels(page)

    await generateBuild(page)
    await page.waitForTimeout(3000)

    // The whole point: the build is on screen and its 3D payload is untouched.
    expect(models, 'GLB models fetched before the user asked').toEqual([])

    const button = page.getByRole('button', { name: /view in 3d/i })
    await expect(button, 'the opt-in button').toBeVisible()
    await button.click()

    // And it is a deferral, not a removal — one tap still gets the real thing.
    await expect
      .poll(() => models.length, { timeout: 60_000, message: 'GLB models fetched after tapping' })
      .toBeGreaterThan(0)
    await ctx.close()
  })

  test('CONTROL: still fetches them without asking on desktop', async ({ browser }) => {
    // ⚠️ Without this the test above is unfalsifiable. "No .glb requests" would
    // read as success if models simply never load in headless at all, or if the
    // URL filter stopped matching — and the feature would look implemented while
    // doing nothing. This proves the probe can see a model being fetched, and
    // that the deferral is scoped to coarse pointers rather than global.
    test.setTimeout(120_000)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    const models = watchModels(page)

    await generateBuild(page)
    await expect
      .poll(() => models.length, { timeout: 60_000, message: 'GLB models fetched on desktop' })
      .toBeGreaterThan(0)

    await expect(page.getByRole('button', { name: /view in 3d/i })).toHaveCount(0)
    await ctx.close()
  })
})

// ⚠️ THE GAP THAT LET A REGRESSION THROUGH. "nothing pushes the page sideways"
// above measures the DOCUMENT, and the document was innocent: the frame-rate
// table lives in a box of its own, so the table outgrowing that box scrolls the
// box and leaves documentElement.scrollWidth untouched. Adding a 24px cover
// plate to the Game column put the table 18px past its container at 375px — the
// commonest phone width there is — and the entire suite stayed green.
//
// Measured, before the fix: 320 was 43px over (already, before the plate), 360
// 3px over, 375 and 390 clean. After the plate: 73 / 33 / 18 / 3. After giving
// the Game column `max-w-0 w-full` and dropping Preset below `sm`: 0 at every
// width, with the name column going from 96px to 190px at 375.
test.describe('the frame-rate table fits the box it is in', () => {
  test('never outgrows its container at phone widths', async ({ page }) => {
    test.setTimeout(120_000)
    await generateBuild(page)

    await page.getByRole('button', { name: /^Performance/i }).click()
    // Genre bars ship shut, so there are no game rows to measure until one opens.
    const genre = page.getByRole('button', { name: /shooters/i }).first()
    await expect(genre).toBeVisible({ timeout: 30_000 })
    await genre.click()
    await expect(page.locator('tbody tr[data-game]').first()).toBeVisible()

    for (const width of PHONES) {
      await page.setViewportSize({ width, height: 812 })
      const fit = await page.evaluate(() => {
        const table = document.querySelector('table')
        const box = table.parentElement
        return { over: box.scrollWidth - box.clientWidth, table: Math.round(table.getBoundingClientRect().width) }
      })
      expect(fit.over, `frame-rate table past its container at ${width}px (table ${fit.table}px)`)
        .toBeLessThanOrEqual(0)
    }
  })

  // The other half. Hiding Preset is only acceptable because the expanded row
  // restates it; a frame rate with nothing saying what setting produced it is
  // a number with no meaning.
  test('still states the preset on a phone, in the expanded row', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 375, height: 812 })
    await generateBuild(page)

    await page.getByRole('button', { name: /^Performance/i }).click()
    const genre = page.getByRole('button', { name: /shooters/i }).first()
    await expect(genre).toBeVisible({ timeout: 30_000 })
    await genre.click()

    const firstRow = page.locator('tbody tr[data-game]').first()
    await expect(firstRow).toBeVisible()
    // The column itself is gone at this width...
    await expect(page.getByRole('columnheader', { name: /preset/i })).toBeHidden()
    // ...so opening the row has to bring it back.
    await firstRow.click()
    await expect(page.getByText('Preset', { exact: true })).toBeVisible()
  })
})

// The build tab's reading order, which is pure CSS `order` and therefore
// invisible to the unit suite — jsdom computes no layout at all.
//
// ⚠️ Two separate risks, so two separate tests. The phone test proves the order
// landed; the DESKTOP test proves it did not leak. `order` is ignored for grid
// items only while every .area-* keeps an explicit `grid-area` — but
// .area-usecase and .area-rating are flex items of .area-left, NOT of
// .build-grid, so their order is NOT inert above lg and is reset explicitly.
// That reset is what the desktop test defends. Measured before it existed:
// rating top=76, usecase top=1437, i.e. the chips flipped below the score.
test.describe('the build tab reads in the right order', () => {
  const topsOf = (page, selectors) =>
    page.evaluate(
      (sels) => sels.map((s) => document.querySelector(s)?.getBoundingClientRect().top ?? null),
      selectors,
    )

  test('on a phone: parts, then the 3D view, then the score', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await generateBuild(page)

    const order = ['.area-parts', '.area-viz', '.area-rating', '.area-usecase']
    const tops = await topsOf(page, order)

    expect(tops, 'every ordered panel is on the page').not.toContain(null)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i], `${order[i]} sits below ${order[i - 1]}`).toBeGreaterThan(tops[i - 1])
    }
  })

  test('on a desktop the grid ignores those order values', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await generateBuild(page)

    const [parts, viz, rating, usecase] = await topsOf(page, [
      '.area-parts', '.area-viz', '.area-rating', '.area-usecase',
    ])

    // The desktop left column keeps chips ABOVE the rating: there they read as
    // the control that drives the panel beneath them. This is the assertion
    // that fails if the desktop `order` reset is ever removed.
    expect(usecase, 'the chips stay above the rating on desktop').toBeLessThan(rating)
    // Both left-column panels sit in the top row, above the full-width parts.
    expect(parts, 'parts stay below the left column').toBeGreaterThan(rating)
    expect(parts, 'parts stay below the 3D view').toBeGreaterThan(viz)
  })

  // The `display: contents` wrapper drops these two out of `.build-grid > *`,
  // which is where `z-index: 1` comes from. Without it they paint under the
  // WebGL canvas and vanish.
  test('the split panels keep the z-index that lifts them off the canvas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await generateBuild(page)

    for (const sel of ['.area-usecase', '.area-rating']) {
      const z = await page.evaluate(
        (s) => getComputedStyle(document.querySelector(s)).zIndex,
        sel,
      )
      expect(z, `${sel} is lifted above the canvas`).toBe('1')
    }
  })
})
