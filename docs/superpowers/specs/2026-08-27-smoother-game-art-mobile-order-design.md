# Smoother, real-looking game art, and the phone's build order — Design

**Status:** approved 2026-08-27
**Touches:** `BuildCanvas.jsx`, `index.css`, `BuilderScreen.jsx`, `art/GameArt.jsx`,
`public/hdri/`, the entry bundle
**Does not touch:** the perf engine's numbers, the geometry modules, the desktop
build grid

Three requests, verbatim: *"lets make it run smoother"*, *"why aren't there
actual profile photos for the games"*, and *"on the phone version have it so its
pick your parts 3d view then score"*.

They are independent and are specified independently below. Only §2 required a
decision that reversed the user's first answer, and that decision is recorded
with the evidence that forced it.

---

## 1. The phone's build order

### The problem

`.build-grid` is `display: flex; flex-direction: column` below `lg`
(`index.css:125`); the grid only appears at `min-width: 1024px`. So on a phone
**visual order is DOM order**, and the DOM order in `BuilderScreen.jsx` is:

| # | area | what it is |
|---|---|---|
| 1 | `.area-viz` | the 3D preview |
| 2 | `.area-left` | `UseCaseChips` + `BuildRatingPanel` |
| 3 | `.area-banner` | `GeneratedBanner` |
| 4 | `.area-parts` | `SelectedPartsPanel` |
| 5 | `.area-warnings` | `BuildWarnings` |
| 6 | `.area-autobuild` | `AutoBuildButton` |

The requested order is parts → 3D → score. Today parts are **fourth**, below a
42vh canvas and two panels.

### The approach: `order`, not a JSX reshuffle

Moving the JSX would work but costs the desktop reading order — the source would
no longer resemble the grid it describes, and `grid-template-areas` is the thing
a reader checks. Instead the mobile-only rules get `order` values.

**This is desktop-safe for placement**, and the precise reason matters. `order`
feeds "order-modified document order", which Grid uses for **auto-placement**.
Every `.area-*` is *explicitly* placed by `grid-area` inside the
`min-width: 1024px` block, and explicit placement ignores order — so no panel can
move.

⚠️ `order` **does** still affect **paint order**, which is the half that is easy
to wave through. Here it is already neutralised: `.build-grid > *` sets
`position: relative; z-index: 1` and `.area-viz` sets `z-index: 0`
(`index.css:126-127`), so stacking is decided by `z-index`, not by source order.
That is a fact about the current stylesheet, not a general guarantee — if those
`z-index` rules are ever removed, this reasoning goes with them.

A test asserts the outcome rather than trusting either argument.

### `.area-left` has to split

`UseCaseChips` and `BuildRatingPanel` are one flex child today. They are not one
thing: the chips are a build **input** ("what do you use it for"), the rating is
the **score**. The request names only the score, so mobile must order them
separately.

#### ⚠️ Two items in one `grid-area` OVERLAP. Measured, not assumed.

The obvious implementation — keep `.area-left` and give both children
`grid-area: left` — **is wrong and was caught by probing a real browser**:

```
grid-template-areas: "left viz" / two items both at grid-area:left
  → a.top = 8,  b.top = 8,  OVERLAP = true
```

Grid stacks same-area items on top of each other; it does not flow them. That
would have printed the chips over the score on every desktop screen.

Splitting the left column into two grid rows is also out — that makes `.area-viz`
span two rows again, which is exactly the dead-space bug the comment at
`index.css:171` forbids.

#### The approach that works: `display: contents`

`.area-left` **stays in the DOM as the desktop wrapper**, and its two children
get the `.area-usecase` / `.area-rating` classes:

- **Mobile:** `.area-left { display: contents }`. It generates no box, so its
  children become flex items of `.build-grid` itself and take `order` directly.
  Probed: `order` 1 / 3 / 4 produced tops 186 → 224 → 262, correctly sequenced.
- **Desktop:** `.area-left` returns to `display: flex; flex-direction: column`
  with `grid-area: left`. Byte-identical to today.

⚠️ **`display: contents` breaks the `.build-grid > *` selector for these two.**
That rule (`index.css:126`) sets `position: relative; z-index: 1`, and selectors
match the DOM tree, not the box tree — so `.area-usecase` and `.area-rating` are
still *grandchildren* and will not match it. They must be given those two
properties explicitly via a descendant selector, or they drop behind the WebGL
canvas — the exact compositing gotcha the comment at `index.css:120` warns about.

Gap is unaffected: `.build-grid` already uses `gap: 0.75rem`, the same value as
the wrapper's `gap-3`.

### Final mobile order

```
1 parts   2 viz   3 rating   4 usecase   5 banner   6 warnings   7 autobuild
```

The rating **is** the score, so it takes position 3 and the use-case chips follow
it. Desktop's `left` column keeps chips-above-rating, its present order, because
there the chips read as the control that drives the panel beneath them.

### Tests

- Unit: every `.area-*` class is present exactly once in the rendered build tab
  (this is what catches the `.area-left` split dropping a panel).
- e2e (`mobileLayout.spec.js`, 390px): `boundingBox().y` is strictly increasing
  across `.area-parts` → `.area-viz` → `.area-rating` → `.area-usecase`.
- e2e (desktop, 1440px): `.area-parts` sits **below** `.area-viz`, and
  `.area-usecase` sits **above** `.area-rating` — together proving `order` did
  not leak into the grid.

---

## 2. Game artwork

### The user asked for real cover photos. They are not available. Here is the evidence.

The user's first answer chose *"IGDB, self-hosted"*. Research contradicted the
premise of that option and the user then chose the drawn-art route with the
facts in hand. Recording both, so this is not re-litigated:

- **RAWG forbids it outright.** Its API terms say to *"refrain from using the
  Services for the purposes of further distribution in any way"*, and the free
  plan requires attribution **plus an active hyperlink on every page** where the
  images appear. (`https://rawg.io/tos_api`)
- **Neither service owns the covers.** RAWG states it plainly: *"We do not claim
  ownership of any of the images or data provided by the API."* The same is true
  of IGDB. So neither can license a cover to us, and self-hosting makes **us**
  the redistributor of ~60 publishers' copyright with a licence from nobody.
- **IGDB is non-commercial only** under the Twitch Developer Services Agreement,
  and its rules say to avoid *"bulk re-publishing the dataset"*. Committing 60
  covers to `public/` is closer to re-publishing than to caching.
- **Hotlinking breaks two things already shipped.** `legalContent.js:80` promises
  *"every other asset [is] served from this site's own domain. There is no
  third-party CDN"*, and `cspHeaders.test.js:64` actively asserts no third-party
  host except Supabase. Both would fail.

This extends, and does not contradict, the reasoning already recorded for
`PartArt`. That note named IGDB/RAWG as the routes that "actually work" for
games; the terms above are why the self-hosted form of that does not.

### The binding constraint is 24 pixels

`GameArt` renders at `w-6 h-6` — **24px** — in `FrameRateRow.jsx:123`, and at
`w-8 h-8` — 32px — in `GamePerformanceList.jsx:43`.

That is icon scale. Detailed illustration is not merely hard here, it is
self-defeating: the `PartArt` work already recorded a drawing that "read as a
smudge" when the frame shrank. **So this is bold single-shape silhouettes with
no feature narrower than ~2 units in a 48-unit box**, not artwork that happens to
be small.

### What each genre gets

Genres are taken from `gameMeta.json`, which is the authoritative set. Counts are
the live corpus:

| genre | games | mark |
|---|---|---|
| `action-adventure` | 21 | chevron blade over a horizon |
| `rpg` | 15 | upright sword with a rune-notched crossguard |
| `shooter` | 13 | reticle: ring with four ticks |
| `strategy-sim` | 6 | three-cell hex cluster |
| `horror` | 4 | crescent moon behind bare branches |
| `racing` | 1 | steering wheel: ring with a T-spoke |
| `moba` | fallback map only | crossed lanes over a nexus diamond |
| `sports` | fallback map only | chevron pennant |
| `other` | fallback | **initials, unchanged** |

`other` keeps the present initials treatment on purpose. A game with no genre has
nothing to draw, and inventing a mark for it would say something false; its
initials say only what is known.

### What is kept

- **The genre gradients stay exactly as they are.** The comment in `GameArt.jsx`
  explaining why these plates are the one non-yellow thing on the site remains
  true and remains load-bearing — this change adds a mark **on** the plate, it
  does not touch the palette rule.
- **`artVariant` still drives variation**, so two shooters side by side differ.
  The mark itself is constant per genre — that is the point of a genre mark —
  but the gradient angle and sweep continue to vary by hash.
- **Determinism.** Still a hash, never `Math.random()`. The existing test
  asserting two seeds render differently must keep passing.

### The 24px check is a real test, not a review note

`art.test.jsx` gains a case per genre asserting the mark renders, and the e2e
suite screenshots the Performance tab at 390px. A mark that dissolves at 24px has
failed even if it renders.

⚠️ **`react-refresh/only-export-components`**: `GameArt.jsx` may not export a
plain function alongside the component. The genre-mark table therefore lives in
its own module (`lib/gameGenreMarks.jsx`) — this rule has already bitten this
exact file once.

---

## 3. Performance

### What was measured

| # | Finding | Evidence |
|---|---|---|
| A | The 3D scene redraws **~60×/sec forever**, idle or not | `BuildCanvas.jsx:27` sets no `frameloop`; r3f's default is `"always"` |
| B | `city.hdr` is **1.5 MB**, for reflections only | `ls public/hdri` |
| C | `antialias: true` at `dpr={[1,2]}` on phones | `BuildCanvas.jsx:28-29` |
| D | ~~`partsData.json` is 163 KB of JS object literal in the entry chunk~~ **WRONG — already handled** | See correction below |
| E | Entry chunk is **518 KB** | `dist/assets/index-*.js` |

(A) is the headline. A static build still burns a full frame budget every 16ms —
on a phone that is the warm-battery complaint directly, and it competes with the
page's own scroll and paint, which is plausibly the "laggy" half too.

### A — `frameloop="demand"`

Draw only when something changes. Two hazards, both real:

1. **Damping.** `OrbitControls` has `enableDamping` (`BuildCanvas.jsx:107`).
   Inertia after a drag needs frames that no state change requests. drei's
   `OrbitControls` calls `invalidate()` on its change event, which covers the
   damping tail — **but this must be verified in a browser, not assumed.** If the
   camera visibly sticks mid-glide, damping is turned off rather than shipping a
   stutter.
2. **`ContactShadows`** re-renders its 512² shadow every frame today. Under
   demand it must be explicitly re-baked when the build changes, via a `key` on
   the selected-part ids. A shadow that bakes once and then never updates is a
   worse bug than the cost it saves.

**Acceptance:** with the build untouched, the canvas issues no draw calls. Proven
by frame instrumentation, not by looking at it.

### B — the HDRI

The environment map is used for reflections and diffuse ambient. Neither needs
1.5 MB. It gets downsampled and re-encoded, keeping the file **local** —
`Environment preset` is a CDN and the CSP forbids it, which is already recorded.

**Acceptance:** a before/after screenshot of the same camera at the same seed.
If the metal or glass visibly degrades, the resolution goes back up. Size is the
goal; the look is the constraint, not the other way round.

### C — DPR and antialiasing on touch

Cap DPR and reconsider MSAA where `pointer: coarse`. This mirrors the mount-time
`matchMedia` read already justified in `BuilderScreen.jsx` — and the same caveat
applies: this is a *renderer* setting, so unlike the zoom-verb copy it does not
have to survive a pointer-type change under a live page.

### D — 🛑 WITHDRAWN. This was already done, and the finding was wrong.

The original claim was that `partsData.json` ships as a JS object literal and
should be converted to `JSON.parse()` on a string. **Checked while planning, and
it is already a `JSON.parse` call** — Vite 8 does this by default:

```
vite/dist/node/index.d.ts:3128
  /** When set to 'auto', the data will be stringified only if the data is
      bigger than 10kB.  @default 'auto' */
  stringify?: boolean | "auto";
```

```
$ grep -o "JSON.parse(.\{0,40\}" dist/assets/index-*.js
JSON.parse(`[{"id":"mb-asus-x670e","category":"mother
```

At 163 kB `partsData.json` is far over the 10 kB threshold, so the transform has
been applying the whole time. **No work here.** Recorded rather than deleted so
the same wrong finding is not made a third time.

### E — the entry chunk

An audit, not a promised cut. `BuildCanvas` and `PerformanceScreen` are already
split out and that work is done; this is checking what remains and splitting it
only where a split is genuinely justified.

### F — interaction jank: measured, not assumed

The user reported the page feeling laggy. **No evidence for this has been
gathered yet**, and none is invented here. The work is: profile scroll and tab
switching against the real dev server, then report what is actually found.

**If the profile is clean, that is the finding and it is reported as such.** No
speculative re-render fix ships without a measurement showing it was needed.

---

## Out of scope

- **GLB decimation.** Settled 2026-08-25 and declined on measurement. Not
  reopened. The models are already 54 MB → 11 MB via meshopt.
- **Any push or deploy.** `main` auto-deploys to Netlify. Standing rule.
- **The perf engine's numbers.** §3 is about frame rate and payload; it must not
  change a single estimate the Performance tab reports.

## Risks

| risk | mitigation |
|---|---|
| `frameloop="demand"` leaves the camera stuck mid-damping | Verify in a browser before commit; drop damping rather than ship a stutter |
| The shadow bakes once and never updates | Re-key on the selected-part ids; e2e adds a part and screenshots |
| A downsampled HDRI dulls the metal | Before/after screenshot at a fixed camera; revert the resolution if it shows |
| `order` leaks into the desktop grid | Desktop e2e asserts parts below viz at 1440px |
| `display: contents` drops the two panels behind the canvas | They get `position: relative; z-index: 1` explicitly; desktop e2e asserts chips above rating |
| A genre mark is mush at 24px | Screenshot the tab at 390px; it is a test, not a review note |
