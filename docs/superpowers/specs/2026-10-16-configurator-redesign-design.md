# Configurator redesign: PC-themed look and phone-first navigation

Date: 2026-10-16. Status: direction approved in the visual companion
(mockup `configurator-direction.html`); this document awaits review.
Builds on `feat/new-flow` (the two-path flow, spec 2026-10-13).

## Intent

Two problems, one redesign.

1. **Phones are a long scroll.** Measured at iPhone 13 size (390×844): Peripherals
   ≈ 14 screens tall, Performance ≈ 5 (≈ 6 with the all-games table open),
   Summary ≈ 4, Build ≈ 2, Saved builds ≈ 2, Welcome and Build-for-a-game ≈ 1.
   Nothing is hidden or broken. Everything is just stacked.
2. **The look is hardware cosplay.** Circuit-trace background, RAM sticks as
   buttons, board designators (DIMM_A2, CPU_FAN, PCIEX16_1). The user wants it
   *PC-related, not hardware-focused*: modern, clear, with a PC spin, and with
   all the information still available. Two earlier mockup rounds were rejected
   as looking "AI-made": the icon-in-a-box row, dark cards and soft glows.

Why it matters (research, 2026-10-16): mobile is ≈60% of global web traffic and
an estimated ≈half of PCPartPicker's US traffic (Semrush, modelled). Mobile
visitors bounce more (≈58–60% vs ≈48–50%, Semrush top-100 US sites). Attention
concentrates at the top: 57% of viewing time above the fold and 74% in the first
two screenfuls (NN/g eyetracking, 2018, desktop). Progressive disclosure: what
is on the first screen signals what matters, and more than two levels of
disclosure hurts usability (NN/g). Collapsible sections help on mobile when they
keep the page in place and can be closed without scrolling back (NN/g). Long
mobile product lists are hard to overview (Baymard), which favours "load more"
over endless lists.

## The approved direction: "configurator"

Taken from what NZXT, Framework, Corsair and ASUS ROG do (studied 2026-10-16):

- **Your PC is the picture.** The site's own 3D render plays the role that
  product photography plays on brand sites.
- **Type with personality.** Wide Archivo headings (the width axis at about
  125%), Hanken Grotesk body, JetBrains Mono for small tags and scale labels.
- **Space and thin lines, not boxes.** Rows are separated by 1px hairlines with
  text aligned to the divider. There is no rounded card per row and no
  icon-in-a-box rows.
- **Total and next step always visible.** On phones, a dock pinned to the
  bottom shows the running total and the primary action, as in Framework's
  configurator.
- **One PC signature, used sparingly:** small monospace bracket tags such as
  `[ ultra / 1440p ]`, `[ 60 games benchmarked ]` and `[ gaming ]`.
- **Palette:** near-black ground `#0e0f12`, ink `#ececee`, muted `#8e9099`,
  faint `#80838d` (raised from `#5d606a` for contrast), hairline
  `rgba(255,255,255,.08)`, and the existing brass `#E0A93B` as the only accent.
  The orange wordmark stays (`accentIsBrandOnly` rule). Dark only.

The mockup (three phone screens: Welcome, Performance, Summary) is the visual
reference. Its values are the starting point, not pixel law.

## Goals

- Every tab's first phone screen gives the answer:
  - Performance: the FPS figure, verdict and lows.
  - Summary: the score, the price and Save/Share.
  - Build: the parts and what is missing.
  - Peripherals: one short list per category.
  - Welcome: the two paths.
- Detail is at most **one tap** away (two disclosure levels max). A folded
  section's header always shows its key numbers, for example "Power and cooling
  — 132 W gaming · supply has 58% spare".
- Peripherals drops from ≈14 phone screens to about 3 or fewer. Performance and
  Summary drop to about 2 or fewer with sections folded.
- The hardware motifs go everywhere: `BoardBackground` (circuit traces),
  `RamBox` (RAM-stick boxes), the board designators on panels, and the
  connector "pads" in `PartSlot`.
- One look across every screen: Welcome, Build for a game, Saved builds, the
  four builder tabs, and the content pages (help, parts browser, part pages,
  glossary, feedback, legal, 404).

## Non-goals

- No change to the engine, data, scoring, optimiser or the two-path flow logic.
- No light theme.
- No licensed product photography or game cover art. Renders come from our own
  3D models; game art stays the site's drawn SVGs.
- No new third-party services. Fonts stay self-hosted.

## Anti-goals (fails even if it "works")

- It looks like generic AI output: icon tiles, a card per row, glows,
  Inter-everything, gradient washes.
- Information is hidden: a folded section that does not show its key figure,
  or anything three taps deep.
- Phones download the 3D bundle (≈11 MB) without being asked. That deferral is
  a signed-off decision and stays.
- Desktop gets worse. Desktop takes the new look but keeps its wide layouts.

## Phone navigation (≤ the `lg` breakpoint, 1024px)

- **Step header** replaces the bottom tab bar on builder screens: `01 Build ·
  02 Performance · 03 Peripherals · 04 Summary` across the top. The current step is
  bold with a brass underline, and done steps are muted. It scrolls sideways if
  it doesn't fit. The steps follow the build's path: a game-target build shows
  `Peripherals · Summary` first, but every tab stays reachable.
- **Bottom dock** pinned on builder screens: the running total, plus the
  primary action for that tab ("Next: Peripherals →"; on Summary, "Save build" plus
  "Share"). It replaces the bottom tab bar and absorbs the `NextStep` button.
- **Folded sections** (Performance and Summary detail only; Peripherals is
  covered below):
  - Built on native `<details>`.
  - Opening one doesn't scroll the page.
  - Its header stays sticky while it's open, so it can be closed without
    scrolling back.
  - Default state: closed on phones, open on desktop.
- **Top bar on phones** *(Claude's call)*: it stays, slimmed to one row:
  - back to Welcome, the wordmark, and the editable budget;
  - the Budget/Power bars leave the phone header (power is on Performance, the
    total is in the dock).
  
  The step header sits directly under it. The top-bar e2e height guard is
  re-measured for the new header rather than deleted.
- **Peripherals** *(Claude's call)*: categories are **not** folded. Each shows
  its first 4 items in the current sort order (price low to high by default),
  then a "Show all 36 monitors" control. That control is the one disclosure,
  so this stays at one level.
  - The chosen item in a category is always shown, even outside the first 4.
  - The 4-item cap is off while a search, filter or non-default sort is
    active, so results are never hidden.
  - There is no "best value" ranking: peripherals have no score, and adding
    one is out of scope.
- **Dock total** *(Claude's call)*: the build's total (`selTotalSpent`),
  labelled "Build". On the Peripherals tab, and on Summary when any
  peripherals are chosen, it reads "Build £X + desk £Y", so the extras are
  never silently added to or left out of the build price.
- **Names** *(Claude's call)*: no rename. The tabs, hashes, headings and copy
  stay "Build", "Performance", "Peripherals" and "Summary". "Desk" was mockup
  shorthand only. On narrow phones the step header may shorten labels
  visually, but their accessible names stay the real ones.
- **Build-for-a-game results:** each option leads with fps, price and "Use
  this build" together. The nine-line parts list folds underneath it.
- **Summary on phones:** score and price first, then Save/Share, then the parts
  list (the first 4 with "+5 more parts"). The 3D view sits below as the
  existing opt-in panel ("View in 3D"), so nothing downloads unasked.
- **Score shown once on Summary.** It's currently duplicated, in the rating
  panel and in BuildSummary.

## Desktop (≥ lg)

- Same type, palette, hairlines and tags.
- The builder keeps its top tab row (restyled as the step header) and its wide
  grid layouts.
- Summary keeps the 3D panel live beside the score.
- No bottom dock on desktop. The total stays in the header; the dock's action
  becomes the in-page "Next" button.

## The PC picture

- **Summary:** the live 3D view of the user's own build (as today), styled
  edge-to-edge with a fade into the ground instead of a bordered panel. On
  phones it stays opt-in.
- **Welcome:** a pre-rendered still of an example build, shipped as a static
  image (WebP or AVIF, a few hundred KB at most). It's captured from our own 3D
  view the way the mockup's render was. *(Claude's call: Welcome can't run the
  live 3D without breaking the "no 11 MB on phones" rule.)*

## Constraints

- **Fonts:** self-hosted only (privacy, and the CSP is `font-src 'self'`).
  `src/fonts.css` records that the Archivo width axis costs about +108 KB as a
  variable font. Ship only what the wide headings need, ideally a single static
  wide instance at the weights used. Measure the byte cost and report it.
- **Performance budget:** the entry bundle must not grow by more than the font
  addition. The perf-model and 3D chunks stay lazy.
- **Pre-render:** the hub and content pages are pre-rendered
  (`npm run prerender`). Re-run it after shared-UI changes, and the committed
  fragments must match.
- **Accessibility floor:**
  - Text at 11px or larger.
  - Body contrast AA (4.5:1).
  - Visible keyboard focus.
  - `prefers-reduced-motion` respected.
  - Tap targets 44px or larger.
  - Landmarks and heading order kept (the existing tests guard these).
- **Existing tests:** suites that pin removed motifs (`boardBackground`,
  `ramBox`, `RamBox`, `BoardBackground`, `performanceChrome`, the designator
  assertions) get deleted or rewritten for the new look, never skipped. Layout
  guards (top-bar height, mobile no-overflow, legibility on the background)
  keep their intent.
- **Never push or deploy** without being asked; merge is not push. Work on a
  branch off `feat/new-flow`.

## Verification

- **Re-run the phone-height measurement** (390×844) per screen, before and
  after, and report both. Targets: Peripherals about 3 screens or fewer;
  Performance and Summary about 2 or fewer (sections folded).
- **Screenshots** of each screen at phone and desktop width.
- **The gate:** `npm run lint && npx vitest run && npm run build`,
  `npx playwright test`, `npm run prerender` with no drift.
- **Font bytes:** report the added font size.

## Left to the builder

- Exact spacing scale, type sizes and responsive breakpoints within the
  direction.
- How to restyle each content page within the system.
- Component boundaries: which current components are reshaped and which are
  replaced.
- Order of work, provided each step leaves the site working and tested.

## Research sources

- Semrush, mobile vs desktop usage: https://www.semrush.com/blog/mobile-vs-desktop-usage
- Semrush, pcpartpicker.com overview: https://cw.semrush.com/website/pcpartpicker.com/overview
- NN/g, scrolling and attention: https://www.nngroup.com/articles/scrolling-and-attention/
- NN/g, progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- NN/g, accordions on mobile: https://www.nngroup.com/articles/mobile-accordions/
- Baymard, mobile product lists: https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/product-list
- Brand sites studied: nzxt.com, frame.work (incl. its Desktop configurator),
  rog.asus.com, corsair.com/s/icue.
