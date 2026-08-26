# Builder tabs onto the board system

**Date:** 2026-08-26
**Status:** approved, phases 2 and 3 of 3
**Phase 1:** [`2026-08-26-board-plan-routing-design.md`](2026-08-26-board-plan-routing-design.md) — merged at `6be10df`

## The problem

Two problems. One is measured; the other is the brief.

### 1. Text sitting on bare board

At 1257px, on a £1600 auto-build, glyph runs over an edge-pinned hardware layer
with nothing opaque painted behind them:

| tab | glyph runs over bare board |
|---|---|
| Performance | 28 |
| Build | 22 |
| Peripherals | 9 |
| **Summary** | **0** |

The hardware layers occupy 0–201px and 1056–1257px at that width. Summary is
`max-w-2xl` and clears them. Performance is `max-w-2xl lg:max-w-[1400px]` and
Build is `lg:max-w-[1760px]`, so both run straight underneath.

⚠️ **Two ways this measurement lies. Both were hit while writing this spec.**

- **An ancestor walk that reaches `body` counts the page ground as protection.**
  `html { background: var(--ground) }` paints *below* the `-z-10` board, so it
  protects nothing. Stop the walk at `body`. The first version of this probe
  reported **0** offenders where there were 32.
- **`sr-only` text is clipped to a 1px box but still returns a client rect.**
  `BuilderScreen` has an `sr-only` `<h1>Your PC build</h1>`, which added one
  phantom offender to every tab and made Summary look defective when it is
  clean. Exclude anything with `clip`, `clip-path`, `visibility: hidden`,
  `display: none`, or `opacity: 0` in its ancestry.

Rects are counted **individually, never unioned** — a union rect over a wrapped
inline spans gutters the glyphs never touch.

**Two causes, compounding:**

1. `Section` and `StatPanel` paint no background at all. That was deliberate:
   the 2026-08-14 redesign stripped borders when the 155 frame-rate cards went,
   because the remaining panels had become the loudest thing on the page.
2. `BuilderScreen` renders `<BoardBackground />` with no `column`, so `column`
   defaults to `0` and **no scrim is drawn**. The component's own comment says
   that value is for *"a screen whose viewport is already covered in opaque
   panels."* That premise is false on three of the four tabs, and nothing
   noticed, because no test looks at a builder tab.

**The frame-rate table is not affected.** `FrameRateTable` and `FrameRateRow`
already use `ELEV_GROUP`, `ELEV_ACTIVE` and `RAIL_ACTIVE` correctly, which is
why their rows stay readable while everything around them does not. The defect
lives in the chrome the table sits in, not in the table.

### 2. The tabs do not speak the site's language

The user's brief, verbatim:

> *"improve the summary page and performance tab it doesn't fit the vibe of the
> website."*

The site has an established hardware vocabulary:

- **`RamBox`** — a panel drawn as the DIMM it stands for. Eight callers.
- **`PartSlot`** — a row drawn as the connector the part plugs into, carrying
  real board designators (`CPU_1`, `DIMM_A2`, `PCIEX16_1`, `M2_1`, `ATX_PWR`).
- **The elevation scale** in `uiTokens.js` — `ELEV_GROUP` / `ELEV_ACTIVE` /
  `RAIL_ACTIVE`.

Outside the frame-rate table, the Performance tab uses none of it.

## What must not change

- **All current information and behaviour.** This is not an
  information-architecture rethink. Nothing is removed, reordered or renamed.
- **Borders are not the hierarchy mechanism.** `uiTokens.js` records that two
  days of de-bordering this page left every surface at the same value, and that
  *depth* carries hierarchy now. Re-adding borders would reverse a decision that
  was made deliberately.
- **No `/NN` opacity modifiers on palette tokens.** `bg-surface/85` emits no CSS
  at all on this palette; `tokenOpacity.test.js` fails the build for it.
- **The board's contrast contract.** Nothing readable may sit on solid gold
  (measured 1.95:1 for `--ink`). The board itself is unchanged by this work.
- **`RamBox` is for hardware that plugs in.** `uiTokens.js` states the rule:
  *"RamBox when the thing on screen stands for hardware that plugs in, PANEL
  when it does not."* A frame-rate table is not a part, so it does not become a
  DIMM. Doing so would be decoration pretending to be structure.

## The design

### Opaque modules, not a scrim

`Section` and `StatPanel` gain `ELEV_GROUP` (`bg-surface`, `#17191D`, fully
opaque), with the heading and blurb **inside** the module rather than floating
above it. Headings outside a module are what most of the 28 offenders are.

The builder does **not** gain a scrim. A scrim protects a prose column; the
builder's answer is opaque modules, which is also what makes a panel read as a
module. This makes `BuilderScreen`'s existing comment true rather than
aspirational.

Elevation only — no borders, no radius changes beyond what the tokens carry.

### Board vocabulary, only where a part owns the section

A designator goes on a panel **only when exactly one real part owns it**. On the
Performance tab that turns out to be the `StatPanel`s, not the `Section`s — each
`StatPanel` describes a single component, while every `Section` spans several:

| panel | designator | owns |
|---|---|---|
| Memory | `DIMM_A2` | the RAM |
| Graphics capability | `PCIEX16_1` | the GPU |
| Processor capability | `CPU_1` | the CPU |
| Power supply | `ATX_PWR` | the PSU |
| Cooling | `CPU_FAN` | the cooler |

Everything else gets none, and the omissions are the discipline:

- **`Power`** is a total draw, not a part.
- **`Bottleneck`** and **`The parts that decide it`** are about the CPU/GPU
  *relationship*; naming one of them would be a claim the panel does not make.
- **Every `Section`** (`Frame rates`, `What's holding it back`, `Power and
  cooling`, `The hardware`) spans more than one part.

⚠️ **Designators must be drawn from `PartSlot`'s `CONNECTOR` map verbatim** —
`CPU_1`, `CPU_FAN`, `DIMM_A2`, `PCIEX16_1`, `M2_1`, `ATX_PWR`, `BOARD`. The
value of a designator is that the same part is named the same way everywhere; an
invented one breaks exactly that. If a panel needs a designator that is not in
that map, it does not get one.

Treatment matches `PartSlot`'s: small, monospace, gold, letter-spaced.

The gold rail needs no work — `FrameRateRow` and `FrameRateTable` already apply
`RAIL_ACTIVE` to the open row and the attended column.

### Summary tab

Carrying forward the decisions already approved on 2026-08-26:

- Rows seat as slots in `PartSlot`'s language, with real designators.
- The retailer link is **revealed on row hover/focus** rather than repeated ten
  times down the right-hand side. (Rejected then and still rejected: a single
  bulk "price up every part" action, and keeping ten always-visible links in a
  quieter treatment.)
- The score block gains a rail in its own score colour.
- One primary button; `Clear build` demoted to a text link, because a control
  that wipes the build should not carry the same weight as the four beside it.

Summary has no legibility defect, so this section is brief-driven, not
defect-driven.

### The guard

A new e2e spec covering **all four builder tabs** asserting that every *visible*
glyph has an opaque ancestor, with the walk stopped at `body` and hidden text
excluded.

Widths: **1024, 1257, 1440, 1920**. The hardware layers are `hidden lg:block`,
so 1024 is the first width at which they paint, and `hardwareWidth`'s clamp
means the layers grow with the gutter — a build that clears them at 1257 can
still fail at 1920. 1257 is kept because it is where the defect was first
measured.

`e2e/boardBackground.spec.js` covers `ROUTES = ['/', '/help', '/glossary',
'/parts']` and no builder tab. That is precisely why this shipped. Without this
spec the same class of bug returns the next time a column widens.

The assertion for the builder is **"every glyph has an opaque ancestor"**, not
"every glyph is inside the scrim's flat core" — the builder has no scrim, and
opaque modules are the mechanism instead.

## Out of scope

- The board itself. Phase 1 is merged and this work does not touch
  `boardPlan.js`, `BoardBackground.jsx` or `boardGeometry.js`.
- The 3D viewport frame, which remains the last `PANEL` caller.
- Any change to what the performance engine computes or claims. Basis labels,
  coverage counts and the honesty rules are untouched.
- Reordering or removing any section on any tab.

## Risks

**Re-adding surfaces after a deliberate de-bordering pass.** The mitigation is
that this adds *elevation*, not borders — the mechanism `uiTokens.js` was
written for and then never wired into `Section` or `StatPanel`. If the result
reads busier, the fix is fewer distinct surfaces, not thinner ones.

**Designators drifting into decoration.** Mitigated by the ownership rule above.
If a section needs a designator invented for it, it does not get one.

**A guard that passes vacuously.** The new spec must be proven to fail: revert
one panel's `ELEV_GROUP` and confirm the offender count rises. A legibility
assertion that cannot fail is worse than none, because it advertises safety.
