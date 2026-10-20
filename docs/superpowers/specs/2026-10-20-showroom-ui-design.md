# Showroom UI — design

Date: 2026-10-20. Status: approved direction ("go"), builder calls marked *(my call)*.

## Intent

The user picked Variant C "Showroom" from the Lovable mockup round as the site's
new look (local copy: `scratch/lovable-mock/Mockup.tsx`, run
`npx vite scratch/lovable-mock --config scratch/lovable-mock/vite.config.mjs`,
open `http://localhost:5190/?s=summary&v=C&d=d`, `s=game|parts|perf|summary`,
`d=d|p`). The idea: the PC itself is the hero, and labels on it, joined by thin
brass leader lines, say what each part is and what it costs. It keeps the
site's "computery" character (mono labels, crop-mark corners, brass accent,
wide display type) and adds to the current site rather than removing from it.

## Goals

1. All four screens restyled to the Showroom look: Build for a game (results),
   Parts (the Build tab), Performance, Summary.
2. **Summary keeps the live 3D model and puts the labels on it** (user). Each
   picked main part — CPU, GPU, cooler, PSU, RAM, storage, motherboard — gets a
   dot on the part, a leader line, and a label with its type, price and name.
3. **Build for a game cards show what changed between the builds** (user).
4. Hover links: hovering a label highlights the matching row in that screen's
   parts list, and hovering a row highlights its label.

## Non-goals

- No change to scoring, the performance model, the optimiser, catalogue data
  or Supabase.
- No new npm dependencies (three, r3f and drei are already here).
- No push and no deploy. Work stays on `feat/showroom-ui` until the user says.

## Anti-goals (a failure even if it works)

- **Removing anything** the current screens have. Everything stays, restyled:
  case toggle, drag/zoom hint, generated-build banner, build checks/warnings,
  use-case chips, score, Best next move, Holding the score back, per-game
  frame-rate table, resolution picker, all Performance folds, Peripherals,
  saved builds, share links, Dock, step header, keyboard tab keys.
- **AI look**: a card around every row, icon tiles, glows, gradient washes.
  Hairlines, not boxes (see `design-direction-lessons` memory).
- **A heavier phone page**: no extra live 3D canvases. Live 3D stays only on
  Summary, still deferred behind the existing tap-to-load on coarse pointers.
- Labels that clip at the frame edge or pile on each other (the bug the
  mockup's first round had).

## Decisions

### Summary — labelled 3D (user: "keep the 3D model and put the labels on it")

- Dots stay pinned to their parts as the model rotates/zooms: each dot is the
  part's world anchor (`partCentre(category)` from `src/lib/assemblyGeometry.js`,
  or a better per-part point) projected to the canvas every rendered frame.
- **Labels sit in two fixed columns** down the left and right edges of the 3D
  frame, so none can leave the frame or overlap; only the leader lines move as
  the camera turns. *(my call, from the mockup's fix)* Which side a label sits
  on, and its order within the column, is fixed per category (mockup `PTS`:
  left = cooler, motherboard, storage, PSU; right = RAM, CPU, GPU).
- A part that isn't picked gets no dot and no label. *(my call)*
- Labels must not cost idle frames: the canvas is `frameloop="demand"`; the
  projection runs only when a frame renders (OrbitControls already
  invalidates on change) and writes positions to DOM through refs, never a
  React re-render per frame.
- If a part's anchor is behind the model or out of view, its line and dot
  hide but its label stays. *(my call)*
- **Phone / coarse pointer** *(my call, from the mockup)*: no columns. Numbered
  tap dots on the main parts (at least CPU, GPU, cooler, PSU) and a strip under
  the canvas showing the tapped part's icon, type, name and price
  ("Tap a number to see the part" when none is tapped).
- Labels/dots render only once the 3D is loaded (same gate as the hint and
  case toggle today).

### Summary — layout

- Desktop (`lg`+), from the mockup: three columns — left: use-case chips,
  score, Best next move, Holding the score back; centre: the labelled 3D;
  right: a spec stack of big mono numbers. Below, full width: the build table,
  then the generated-build banner and build checks.
- Spec stack shows figures the site already computes for this build, e.g.
  price vs budget, peak power vs PSU, PSU headroom, cooling margin, and fps for
  the stored target game when there is one. Builder picks the exact set from
  what exists; nothing new is modelled.
- Build table: one row per part — icon, type label, name (never truncated;
  wraps), a slim bar of that part's share of the total, the %, the price;
  total row. Hover-linked to the labels.
- Phone order *(my call — keeps the user's earlier research-backed "answer
  first" order rather than the mockup's 3D-first)*: banner, score + use case,
  labelled 3D with tap strip, spec stack as a 3-column grid, build table.
  Summary is already over its ≤2 phone-screens target (≈2.4); this must not
  make it longer than today — measure with
  `node scripts/measure-mobile-heights.mjs`.

### Build for a game — "show what changed" (user)

- Card 1 (Cheapest) shows the whole PC, labelled "Base build" with its CPU +
  GPU names.
- Cards 2 and 3 each show a close-up of the part **type** that changed most
  against the card to their left, judged by the absolute price difference of
  that part. The label names the new part and its real price difference
  ("GPU · RX 9070 GRE · +£95"; a cheaper swap reads "−£40") and lists any
  other changed types ("CPU also changed"). `buildCards` already gives the
  `changed` set and both options' parts, so the deltas are exact.
- Pictures are **one still image** of the whole build, captured from the
  site's own labelled 3D view by a script in the style of
  `scripts/capture-welcome-render.mjs` (WebP in `public/img/`, ≤ 160 KB),
  plus the anchor positions of each part in that image (read from the live
  overlay's dots at capture time). A close-up is that still zoomed (CSS
  transform) on the focus part's anchor, as the mockup does. *(my call: one
  file instead of one per type — fewer bytes, one capture.)* No live 3D on
  this screen.
- A merged twin card (buildCards' "also …") is unchanged in behaviour.
- The Best value card is visually dominant: slightly raised, brass outline,
  a "Recommended" tag, filled primary button; the others use ghost buttons.
- The changed-part markers in each card's parts list stay; restyle them to
  the mockup's pictogram + brass dot.
- Layout from the mockup: on desktop the inputs (game, graphics, resolution,
  target fps, budget, Find builds) sit in one bordered row across the top
  instead of a left sidebar; three result columns below. Phone: inputs in a
  2-column grid, cards stacked. All current messages (no data, over budget,
  unreachable, "Nothing above the cheapest build is worth the extra money")
  stay.

### Parts (Build tab)

- From the mockup: single-column parts list with the showroom picture beside
  it on desktop (picture on the right, sticky), above it on phones.
- *(my call)* The picture here is the whole-build **still** with the same
  label columns/tap dots as Summary, filled from the picked parts — not live
  3D, to keep "3D only on Summary" and the phone data budget. Easy to switch
  to live 3D later if the user wants.
- Rows: pictogram, type label, name (wraps on phones, price under the label),
  price, remove. Hover-linked to the labels. Build checks stay.

### Performance

- All current sections and folds stay. On desktop a third column holds the
  showroom still with CPU and GPU labels only (the bottleneck pair).
  Phone: the same, placed after the bottleneck section. *(my call)*

### Shared look

- Port the mockup's line pictograms (`Picto` in the mockup) as one shared
  component unless the existing `components/art` icons already match that
  stroke style.
- Crop-mark corners on every showroom frame.
- Sticky header + step row unchanged *(my call: the mockup's non-sticky header
  only worked around a mockup-frame bug)*.
- Palette unchanged: `brass` the only accent; text ≥ 12px; targets ≥ 24px
  (44px on phones where they are today); existing a11y guards must stay green.

## Constraints and traps (from project memory)

- The Summary column is `transform-gpu`: fixed overlays inside it must portal.
- `.area-viz` and everything inside it must keep `touch-action: pan-y`
  (`e2e/mobileLayout.spec.js`), so the dots/labels layer must not set `none`.
- The builder scrolls an inner div, not the document.
- Re-run `npm run prerender` after shared-UI changes; check CSP with
  `npm run preview:csp` for anything that loads new assets.
- e2e helpers match step buttons and cards by name; update selectors where
  markup changes, never delete a guard.

## Left to the builder

Exact anchor points per part, label column spacing, the spec-stack field list,
breakpoints between phone and desktop behaviour, image capture angles and
sizes, and test shape — as long as the goals, anti-goals and decisions above
hold. Done = all four screens match the mockup's Showroom look with real data,
lint + unit + e2e + CSP suite green, prerender regenerated, screenshots of
every screen at desktop and phone shown to the user.
