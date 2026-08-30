# Build page fixes and hardening — design

Date: 2026-07-30
Status: approved

Nine fixes to the builder, reported together. They are independent of each other
apart from items 1 and 4, which both edit `.build-grid`.

---

## 1. Dead space above the rating panel when zoomed out

### Diagnosis (confirmed by measurement, not inspection)

`.area-viz` spans two grid rows — `usecase` and `rating` — and carries
`lg:min-h-[60vh]`. CSS Grid distributes a spanning item's excess height
**equally across every row it spans**. Half the excess therefore lands in the
`usecase` row, as dead space between the chips and the rating panel.

Measured in the running app, gaming build at £1700, `gap-above-rating` =
`rating.top - (usecase.top + usecase.height)`:

| viewport height | `grid-template-rows` row 1 | usecase content | gap |
|---|---|---|---|
| 1900px | 106.4px | 59px | **47px** |
| 2400px | 256.4px | 59px | **213px** |

The gap is linear in `60vh`, and browser zoom-out multiplies the viewport's CSS
pixel height by `1/zoom` — which is exactly the reported reproduction.

### Fix

Collapse the two left-hand rows into a single grid area:

```
"left      viz"
"banner    banner"
"parts     parts"
"warnings  warnings"
"autobuild autobuild"
```

`.area-left` is a flex column holding `UseCaseChips` then `BuildRatingPanel`.
`.area-viz` now spans exactly one row, so there is no excess to distribute: the
row resolves to `max(left content, viz min-height)` and the left column stacks
from the top under the existing `align-items: start`.

### Guard

jsdom computes no grid layout, so a unit test **cannot** catch this class of bug.
The regression guard goes in the Playwright E2E: at a tall viewport, assert
`rating.top - (usecase.top + usecase.height) <= gridGap + 1`.

---

## 2. The parts list does not read as "your selected parts"

`CategoryList` in `area-parts` has no heading, and a selected row shows only the
product name — "ASRock H610M-HDV/M.2 DDR4" never says *motherboard*.

- Wrap the list in a `PANEL` with a header: **"Your parts"**, a
  `N of M essentials chosen` counter, and the running spend.
- Each selected row gains a small uppercase category label above the product
  name, matching the existing rating-panel row treatment.

The counter counts **essentials only** (the nine non-optional categories), so a
complete build reads `9 of 9` rather than a permanent `9 of 10`.

---

## 3. Missing parts must be obvious

Three visual states replace today's two.

| State | Treatment |
|---|---|
| Chosen | solid `bg-surface`, accent dot, category label + name + price |
| Required, missing | dashed `--bad` border, red-tinted fill, `Missing` tag |
| Required, missing **and** next up | same red tint **plus** a solid accent `Pick one` pill |
| Optional, missing (`paste`) | dashed neutral border, tag: `Optional — most coolers ship with paste applied` |

Red means a real hole; accent means do this one next; grey means deliberately
empty. Colour alone never carries the meaning — every state also carries its own
text tag, so this survives colour-blindness and greyscale.

`--bad` is reused rather than a new token: the good/ok/bad trio is semantic and
constant, and "required part absent" is the same class of signal as a failing
build check.

### Thermal paste

Paste stays in `OPTIONAL` in `recommendedOrder.js` and auto-build continues not
to buy it. What changes is that its empty slot is *explained* rather than merely
blank. No pricing or auto-build behaviour changes.

---

## 4. Content width and preview size

- Container: `w-full max-w-2xl lg:max-w-6xl 2xl:max-w-[88rem]` →
  `w-full max-w-[1800px]`, horizontal gutters `px-4 lg:px-6`. Vertical padding
  (`pt-3 pb-12`) is unchanged.
- Column split: `minmax(0, 1fr) minmax(0, 1.5fr)` → `minmax(0, 1fr) minmax(0, 2fr)`.
  At 1800px the viz column goes from ~660px to ~1200px.
- Viz min-height `lg:min-h-[60vh]` → `lg:min-h-[65vh]`.

Below `lg` nothing changes: the single-column stack and its `h-[42vh]
md:h-[48vh]` viz are untouched.

---

## 5. 3D zoom range and starting scale

`BuildCanvas` today: `camera.position [1.7, 1.05, 5.6]`, `target [0, -0.1, 0.05]`
→ orbit distance ≈ 5.92. At `fov 46` the visible frame height is
`2 · d · tan(23°) ≈ 0.849 · d` = 5.03 wu, and the case is 482 mm = 3.95 wu, so it
fills ~78% of frame height.

| | before | after |
|---|---|---|
| start distance | 5.92 | **≈ 7.2** (`position [2.05, 1.3, 6.8]`) |
| case fills | ~78% of frame height | **~65%** |
| `minDistance` | 3 | **2.2** |
| `maxDistance` | 9 | **16** |

Zoom range widens from 3× to ~7×. `WU_PER_MM` was chosen so the old clamps still
worked; moving them is a deliberate change, not a drift.

---

## 6. Top bar

Content stays as-is — the user confirmed the information is right. Two things
look wrong.

**Tabs** (`ViewTabs`, `inline` variant) become a proper segmented control: an
inset `bg-ground` track so the group reads as a well rather than a floating box,
equal-width segments, and the same icons the bottom bar uses. The group moves to
the header's centre instead of being jammed against the right-hand group.

**Meters** (`DynamicBars`, non-compact variant) become gauge chips: value in mono
above a shorter, thicker rounded track, inside a bordered `bg-surface-2` chip, so
they group with the tabs instead of trailing off as stray hairlines. The
`compact` phone variant keeps its current shape.

Header becomes three zones: left (`flex-1`: back, wordmark, budget readout),
centre (`shrink-0`: tabs), right (`flex-1 justify-end`: meters, feedback).

Note the tabs are only *truly* centred at `xl`+, where both flanks carry weight.
Between `lg` and `xl` the meters are hidden, so the right flank is lighter and
the group sits right of true centre. That is expected — do not "fix" it by
absolutely positioning the tabs, which would let them overlap the flanks and
break the one-row rule.

### Constraint that must not regress

The header must stay **one row at every width**. Its breakpoints were measured,
not guessed: tabs at `lg` (at `md` the header wrapped to 81px at 768), meters at
`xl` (at `lg` it wrapped to 81px at 1024), wordmark `hidden min-[360px]:inline`.
After the restyle, re-measure `header.getBoundingClientRect().height` at
320/375/390/414/640/768/1023/1024/1280/1440/1920 and confirm: one row, no
horizontal scroll, exactly one tab set visible.

---

## 7. Crash page

There is no root error boundary today — only `CanvasErrorBoundary` and
`ModelErrorBoundary`. A throw anywhere else blanks the page.

New `src/components/ErrorBoundary.jsx`, wrapping `<App/>` in `main.jsx`. It
renders the wordmark, a plain-English message, and three actions:

1. **Reload** — `location.reload()`.
2. **Back to menu** — sets `flow: 'hub'` and clears the error, leaving the build intact.
3. **Reset the app** — clears `custompc-builder-v1` from `localStorage` then
   reloads. Behind a confirm step, because it destroys the user's build.

Plus a collapsible technical detail carrying `error.message` and the component
stack, so a bug report is actionable, and a link to `#/feedback`.

Reset matters specifically because corrupt persisted state is the most likely
cause of a crash that survives a plain reload — reloading alone would loop.

Styled with the Workbench tokens. The boundary must not itself depend on the
store or the catalogue, or a store-shaped crash would take the fallback down too.

---

## 8. Human check on the feedback form

Scope: **the submit path only**. The site is static and public with no accounts,
and feedback is the sole write path. A site-entry gate would cost every real
visitor and, being client-side, stops nothing determined.

No image CAPTCHA is available: there is no external service, and `public/_headers`
blocks third-party hosts. So, three cheap local signals layered on the existing
honeypot:

1. **Arithmetic challenge** — "What is 7 + 4?", regenerated per mount.
2. **Time-to-submit floor** — a form completed in under 2.5s is a bot.
3. **Honeypot** — unchanged, already present.

Pure and unit-testable in `src/lib/humanCheck.js`:

- `makeChallenge(rng = Math.random)` → `{ a, b, question, answer }`
- `checkAnswer(challenge, input)` → boolean, tolerant of whitespace
- `submittedTooFast(mountedAt, now, floorMs = 2500)` → boolean

A failed check shows an inline error and regenerates the challenge; it never
silently succeeds (unlike the honeypot, where silence is the point).

**Stated plainly:** this stops naive scripted spam and nothing more. The real
defence remains the Supabase `SECURITY DEFINER` trigger — 5 inserts per source
per 10 min, 30/min global.

---

## 9. Peripheral price filters

Today `BANDS` is one global `All / Value / Mid / High-end` row, and `bandOf`
resolves it against **per-category terciles**. One chip therefore means ~£30 for
a mouse and ~£300 for a monitor at the same time, and the label says neither.

Replace with **per-category chips carrying real money**. For mice that might read:

`All · Under £25 · £25–£50 · £50+`

...and for monitors, `All · Under £150 · £150–£300 · £300+`. The boundaries are
not fixed — they derive from each category's own catalogue prices, then snap to
the nearest value on a fixed ladder so labels are always round:

```
[10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]
```

Each chip shows its option count. Filter state becomes per-category (`{monitor:
'all', keyboard: 'all', …}`), replacing the single shared `band`. Default `all`.

Pure and unit-testable in `src/lib/priceBands.js`:

- `snapToLadder(price)` → nearest ladder value
- `priceBands(prices)` → `[{ id, label, min, max }]`, always starting with `all`

Degenerate cases the function must handle: an empty catalogue (return `all`
only), and a category whose prices all snap to one boundary (collapse to `all`
rather than emitting empty bands).

---

## Testing

New:

- `src/tests/priceBands.test.js` — ladder snapping, band derivation, both degenerate cases.
- `src/tests/humanCheck.test.js` — challenge generation with a seeded rng, answer checking, the time floor.
- `src/tests/ErrorBoundary.test.jsx` — a throwing child renders the fallback; reset clears `localStorage`; the fallback renders with no store present.
- `src/tests/CategoryList.test.jsx` — extend for the three empty states and the essentials counter.

Updated:

- `src/tests/TopBar.test.jsx`, `src/tests/DynamicBars.test.jsx`, `src/tests/PeripheralsPanel.test.jsx`.
- `e2e/wizard.spec.js` — the grid-gap assertion at a tall viewport.

Manual, in a real browser (jsdom cannot answer any of these):

- Header height across the eleven measured widths.
- The zoom-out reproduction at 50% and 67% browser zoom.
- 3D start framing and both zoom clamps. Budget the reloads — the WebGL context
  is exhaustible and a fresh tab is the reset.

Existing baseline to hold: **453 tests, lint clean, prod build OK.**

---

## Out of scope

Auto-build behaviour, pricing, the CustomPC score and its calibration, the
catalogue, the Supabase schema, and the known motherboard-mesh sizing bug.
