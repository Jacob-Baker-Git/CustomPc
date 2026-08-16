# RAM-stick boxes and a zoned motherboard background

**Date:** 2026-08-16
**Status:** approved (design)
**Follows:** `2026-08-16-matte-black-copper-board-ui-design.md`

## Why

The board UI established a matte-black substrate with copper action and gold
state, and taught part slots to draw themselves as the connector their part
plugs into. This takes the next step: the generic rounded-rectangle **panel**
becomes a **DIMM** — the same physical part at every size — and the page it sits
on becomes a **motherboard** rather than a flat ground.

The container stops being neutral chrome and starts being the thing the site is
about. That is the whole argument; everything below is how to do it without
costing legibility.

## The part

Anatomy, top to bottom. All of it was tuned against the reference photographs
across nineteen visual iterations; the numbers here are the settled ones, not
starting points.

### Fin blades

A row of skewed blades rising above the heatspreader, cut into two banks that
rake in **opposite directions**.

| bank | span (% of box width) | height | skew |
|---|---|---|---|
| left | `2–18`, `22–32`, `36–57` | 12px | `skewX(20deg)` |
| right | `64–82`, `85–100` | 16px | `skewX(-20deg)` |

- `transform-origin: bottom left` so the bottom stays anchored to the body.
- Each blade carries a 1px lit top edge (`#6d7683 → #8992a0 → #4d545f`) so it
  catches light rather than reading as a flat cut-out.
- **Positions are percentages, deliberately.** This was chosen over fixed-width
  blades with full knowledge of the trade: percentage keeps all five blades and
  the tuned rhythm at every size, at the cost of tooth size varying with box
  width. Fixed was prototyped, compared side by side at three aspect ratios, and
  rejected because narrow boxes lost blades entirely (a 150px box kept two of
  five). **Do not "fix" this later without re-opening the decision** — it is a
  choice, not an oversight.

### End caps

10px wide, full body height, on both edges. `linear-gradient(90deg, #4a515c,
#2b3038 40%, #22262D)` on the left and the 270deg mirror on the right, so both
catch light from the same side.

### Heatspreader body

The only element that stretches. `linear-gradient(180deg, #2c323b 0 2px, #252a33
2px 26px, #1d2128 26px, #191c22)` with a 1px `--line-strong` border and no bottom
border, plus a vertical brushed grain at 55% opacity
(`repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px
3px)`).

### The lit bar

40% of box width, 9px tall, 8px down from the top, flush to the left cap.
Gold gradient with a soft bloom. **This is a state carrier, not decoration** —
see States below.

### Contact edge

13px tall strip, `#13161b`, 1px border, no top border. Gold fingers at a
**3.2px repeating pitch** (`#D9BE8A` 1.7px, `#8a6f3f` shadow 0.4px, gap 1.1px),
running **corner to corner**. Broken only by the off-centre keying notch — 6px,
`--ground`, with 1px inset lines on both sides.

Two details were built and then deliberately removed:

- **Corner mounting notches.** Drawn as dark boxes stamped over finished gold,
  which slices live pads and reads as manufacturing damage rather than as board
  outline. Removed rather than corrected; the keying notch already carries "this
  only goes in one way," which is the meaning that matters.
- **Cut-through slashes** on the upper right. They obscured the spec text in the
  header row. Their removal is why nothing on the box is transparent, which in
  turn means the background never shows through a box — noted below as a
  deliberate loss.

### Scaling

Fins and contact edge are **fixed height**; only the heatspreader stretches. A
square box is the same stick with a taller body, never a scaled-up drawing.
Verified at wide (470×120), square (270×270) and tall (180×300).

## States

Two orthogonal axes. A box can be seated-and-closed, seated-and-open,
empty-and-closed, or empty-and-open.

### Seated vs empty

| element | seated | empty |
|---|---|---|
| lit bar | gold gradient | `#262a31`, unlit |
| contact fingers | live gold | dark bronze (`#5c5340 / #3b3527`) |
| body, fins, caps | unchanged | unchanged |

Empty is expressed by **light and copper going out**, never by changing the
part's shape. An unpopulated slot is the same hardware, cold.

### Closed vs open — the box unseats

Opening a box lifts it clear of its socket:

1. The stick translates **up 9px**, opening a gap beneath it.
2. **Retention clips rock outward** — 9×22px bars at the outer edges, from
   `rotate(0)` to `rotate(∓26deg)`, `transform-origin: bottom center`.
3. **Contacts go cold.** The connection is genuinely broken.
4. The **vacated socket** appears below: 15px, dark, with an inset gold glow
   (`inset 0 3px 7px -2px`) and its own keying notch.
5. The body **grows** to hold the expanded detail.

#### The colour conflict, and how it resolves

Gold means *seated* in this system. But `RAIL_ACTIVE` also paints the
*attended-to* thing gold. Unseating collides them: an open box is at once the
most active and the least seated element on screen.

**Resolution — split by which gold.** The lit bar stays on, because it signals
attention and opening does not end attention. The contacts go cold, because they
signal connection and that has been broken. The gold then migrates *down* into
the empty socket, so the eye follows the part out of its slot. One colour, two
jobs, made legible rather than contradictory.

The alternative — kill the bar too, let the socket carry all the gold — was
considered and rejected: it leaves an open box with no lit element at all, so it
stops reading as the focus.

## The background

**Zoned.** Full-strength board artwork in the side gutters; plain `--ground`
behind the content column.

- Traces: gold at ~30% stroke opacity, 1.1px, routed in right angles and 45°
  diagonals, with parallel bus runs of 3–4 lines.
- Vias: 2.8px filled circles at ~34%, placed on trace corners only.
- Ghosted slot outlines: DIMM and PCIe rectangles, 2px radius, ~22%.
- The content column is painted flat `--ground` over the artwork.

Whisper (8%, everywhere) and full Board (30%, everywhere) were both built and
rejected. Board photographs best and is the one that would hurt: `/help`,
`/glossary` and the legal pages carry long prose, and gold traces under body
text degrade badly on a phone in daylight. Zoned gives the full board where
there is nothing to read and protects the column where there is — and on wide
screens the gutters are large, so it shows *more* board than the full-bleed
option, not less.

### The contrast hazard

`paletteContrast.test.js` guards 31 `text-faint` call sites by measuring text
against a **flat token colour**. A patterned background is invisible to it.

**Requirement:** the darkest text must pass WCAG AA against the *brightest trace
pixel*, not against `--ground`. This is a measurement to take in the browser
during implementation, not an eyeball. If a trace value fails, the trace darkens
— text colours are not to be brightened to accommodate artwork.

## Component inventory

`RamBox` replaces `PANEL` at these seven call sites:

`BuildRatingPanel.jsx:68` · `BuildSummary.jsx:132` · `BuildWarnings.jsx:11` ·
`PeripheralsPanel.jsx:113` · `SavedBuilds.jsx:106` · `SelectedPartsPanel.jsx:28` ·
`SetupFlow.jsx:205`

Expandable consumers additionally adopt the unseat behaviour: `BuildRatingPanel`,
`BuildSummary`, `PartCard`, `PeripheralsPanel`, `ScoreInfo`,
`performance/FrameRateRow`, `performance/BasisBar`.

`PANEL_STRONG` (popovers, floating menus) **stays a plain panel**. A floating
menu is not a seated part; giving it contacts would be decoration pretending to
be structure — the failure mode the designators exist to avoid.

### Boundaries

- `RamBox` owns chrome only: fins, caps, body, bar, contacts, socket. It takes
  `seated`, `open`, `designator`, `children` and knows nothing about builds,
  parts or prices.
- Blade geometry lives in one exported constant, not scattered inline styles, so
  the percentage-vs-fixed decision has exactly one place to be revisited.
- The socket renders as a sibling below the box, not inside it — a slot is not
  part of the part.

## Testing

- **jsdom computes no layout.** Unit tests can assert structure, class presence
  and state transitions; they cannot assert that a blade is 12px tall or that a
  box does not overflow. Anything geometric belongs in `e2e/`.
- New unit tests: seated/empty rendering, open/closed transitions, contacts
  cold when open, socket present only when open, designator rendered.
- New E2E: the box at three aspect ratios with all five blades present; the
  contrast measurement above; no per-element overflow at 1280px (see below).
- **No `/NN` opacity modifiers on palette tokens** anywhere in this work.
  `bg-surface/85` emits no CSS on this palette and `tokenOpacity.test.js` fails
  the build for it. Alpha belongs in raw gradients and `box-shadow`, which name
  the CSS var directly.
- Brand orange stays wordmark-only; `accentIsBrandOnly.test.js` covers four
  sites, not two.

## Bundled bug fixes

Unrelated to the redesign, shipped in the same branch because they touch the
same files and the same test surfaces.

1. **Top bar clips at 1280px.** At exactly `xl`, the `hidden xl:flex`
   budget/power group at `TopBar.jsx:100` extends to 1415px in a 1280px
   viewport; the POWER figure is cut off. It fails **silently** —
   `scrollWidth === clientWidth`, so no scrollbar appears and page-level
   overflow checks report clean. The guard must be a **per-element** probe
   (`getBoundingClientRect().right > clientWidth + 1`) in `e2e/`, since that is
   the only place CSS applies.
2. **`tokenOpacity.test.js` structural blind spot.** It builds its regex from
   the Tailwind config, so a class whose token has been *removed* is invisible
   to it — `bg-accent-soft/40` returns zero violations once `accent.soft` is
   gone. Add the second, still-unwritten test: compile with
   `npx tailwindcss -c tailwind.config.js -i src/index.css -o out.css --content
   <file>` and assert every class in `src` resolves to a rule. The output is
   **unminified** (`.bg-surface {`, with a space), so a `\.cls\{` pattern
   returns zero for live classes too — the test must probe a known-good class as
   a control or it silently passes.

## Risks and deliberate losses

- **Nothing on the box is transparent.** Removing the slashes means the board
  behind never shows through a box. The link between part and substrate is now
  carried by the socket alone. Accepted; revisitable by returning the slashes
  lower down where no text runs.
- **Density.** The board UI review already recorded "too dense" as only
  partly answered. This adds fins, caps, contacts and sockets to every panel.
  If the build page reads as busier after this lands, the honest fix is fewer
  boxes, not quieter boxes.
- **Percentage blades** make tooth size a function of box width, so a page of
  mixed sizes shows visibly different teeth. Known, chosen, documented above.
- **Pre-render staleness.** `prerendered/*.html` is committed source injected
  into `dist/` at build time, and **no test knows when it was captured**. This
  is a shared-UI change touching every panel, so `npm run prerender` must be
  re-run before merge and the output grepped for classes that should be gone.
  The full suite passing proves nothing here.

## Out of scope

3D scene, performance engine, catalogue, routing, and the remaining perf-engine
items (unindexed CPUs, 1080p fitted from 11 cards). No push or deploy without an
explicit ask.
