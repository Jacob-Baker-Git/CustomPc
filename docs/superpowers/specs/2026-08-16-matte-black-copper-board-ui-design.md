# Matte-black + copper board UI — design

**Date:** 2026-08-16
**Status:** approved, not yet planned
**Supersedes:** nothing. Builds on the shipped "Workbench" look and the
"Instrument" depth pass (elevation scale, promoted figure, accent rail), both of
which survive this change.

---

## Why

The user asked for a new UI, naming four drivers at once: too plain/flat, too
dense/spreadsheet-y, looks generic/templated, doesn't feel exciting — plus an
explicit "it needs character, not AI slop".

**The diagnosis that shaped everything below:** the current design is one of the
three looks AI-generated design currently defaults to — *near-black ground with a
single bright accent* (`#0F1114` + `#F26B3A`). A second default is *hairline
rules, no radius, dense columns*, which is where de-bordering the Performance tab
had been heading. The look is not generic by accident; it landed on two of the
three houses that get reached for by default.

That produces a hard constraint: **the replacement may not be near-black plus one
bright accent.**

## The idea

The UI takes its visual language from the thing the site is about — a
motherboard. This is the answer to "generic": no other site looks like a board
because no other site is about boards. It is the subject's own vernacular rather
than a style applied on top of it.

## Decisions taken (by the user, in this order)

1. **Direction** — component/board-based, chosen over an assembly-manual
   direction and a metal-and-glass evolution.
2. **Material** — matte black + copper, chosen over classic green, deep blue,
   and bare FR4. Rationale: it is what high-end boards actually look like now,
   and it keeps a dark ground so the 3D scene still sits correctly on it.
3. **Brand orange is reserved for the wordmark.** Everything else is matte black
   and copper. This makes `#F26B3A` the only fully saturated colour on the site.
4. **Structural depth: connectors-as-slots.** Every part slot is drawn as the
   connector it plugs into, but the page keeps its current list order and
   layout. The full "board map" layout was explored and deliberately deferred.
5. **Type: replace the display face only.** "Do what looks best but is free" —
   all candidates were SIL OFL, so this was decided on merit and payload.

## Token system

### The governing rule

**Metals are desaturated and carry state. Signals are saturated and interrupt.**

This is what resolves the collision the brand decision creates: the existing
`--ok #F2B84B` sits almost on top of gold, and `--bad #F26A5A` sits almost on top
of the brand orange `#F26B3A`. Without the rule, a compatibility warning reads as
a seated slot and an error reads as the logo.

### Mapping, current → new

**Every value below is MEASURED, not assumed.** Contrast was computed with
linearised sRGB channels against all four surfaces; the table at the end of this
section is the evidence. Two values changed *because* the measurement failed
them.

| token | current | new | note |
|---|---|---|---|
| `--ground` | `#0F1114` | `#0E0F11` | board substrate |
| `--surface` | `#181A1F` | `#17191D` | panel |
| `--surface-2` | `#22252C` | `#22262D` | active / inset — keeps the Instrument elevation step |
| `--line` | `#2A2E36` | `#2A2E35` | hairline |
| `--line-strong` | `#363B45` | `#3A404B` | emphasised |
| `--ink` | `#EDEFF2` | **unchanged** | see below |
| `--muted` | `#99A0AB` | **unchanged** | see below |
| `--faint` | `#878E9C` | **unchanged** | see below |
| `--accent` | `#F26B3A` | `#F26B3A` *(unchanged value, radically changed job)* | **wordmark only** |
| `--accent-soft` | `rgba(242,107,58,.15)` | retired | replaced by `--gold-soft` |
| `--accent-ink` | `#1B1206` | `#0E0F11` | text on a metal fill |
| `--steel` | `#5E6672` | `#5E6672` | unchanged — neutral secondary meter |
| `--good` | `#3CCB82` | `#45C182` | calmer, still unmistakably green |
| `--ok` | `#F2B84B` | `#F5B62E` | brighter/more saturated, to separate from gold |
| `--bad` | `#F26A5A` | `#E8695C` | red, not orange — see the failure note below |

### ✅ The three text tokens do NOT change

`ink` / `muted` / `faint` were measured against the new surfaces and all three
pass AA with the hierarchy intact — `12.47 > 5.76 > 4.61` on the new
`--surface-2`. Candidate replacements were tried and were *worse*: a dimmed
`#8C929C` muted left only a `+0.24` gap over faint, collapsing three steps into
two.

**Consequence: 31 `--faint` call sites and every `ink`/`muted` use are
untouched.** The identity change is carried entirely by the metals replacing
orange, not by the greys. The greys were already right.

### New tokens

| token | value | job |
|---|---|---|
| `--copper` | `#C4813C` | **action** — primary buttons, power |
| `--gold` | `#C9A86B` | **seated / active** — filled slots, the active rail |
| `--gold-soft` | `#2A2416` | the selected wash `--accent-soft` used to provide |
| `--tech` | `#56C8D8` | **technical** — reference designators, measured-data labels |

Gold is deliberately pulled down from the `#E8C36A` of the first mockup so it
reads as material rather than as a warning; that is what frees `--ok` to be
genuinely bright.

### ⚠️ Two values were changed by the measurement, not by taste

- **Copper was `#B87333`** — true copper, and it **fails AA at 4.00** on
  `--surface-2`. Lightened to `#C4813C` (4.74). Rejected alternative: keep true
  copper and declare it fill-only. That works arithmetically but leaves a trap
  nobody remembers, so the token passes everywhere instead.
- **Error was `#D9453C`** — the reddest option, best separated from the brand
  orange, and it **fails AA at 3.52**. Lightened to `#E8695C` (4.78). This costs
  separation from `--accent` (RGB distance 46 → 35), accepted because the
  wordmark lives in the header and errors live in content, they never sit
  adjacent, and **colour never carries the meaning alone** — every signal has an
  icon and a sentence.

### Measured contrast — the evidence

Foreground × background, WCAG AA needs ≥ 4.5 for normal text.

| token | ground | surface | surface-2 | gold-soft |
|---|---|---|---|---|
| ink `#EDEFF2` | 15.76 | 14.46 | 12.47 | 12.67 |
| muted `#99A0AB` | 7.28 | 6.68 | 5.76 | 5.83 |
| faint `#878E9C` | 5.83 | 5.35 | 4.61 | 4.68 |
| copper `#C4813C` | 5.98 | 5.49 | 4.74 | 4.81 |
| gold `#C9A86B` | 8.49 | 7.79 | 6.72 | 6.82 |
| tech `#56C8D8` | 9.72 | 8.92 | 7.70 | 7.82 |
| good `#45C182` | 8.40 | 7.71 | 6.65 | 6.76 |
| ok `#F5B62E` | 10.60 | 9.73 | 8.40 | 8.52 |
| bad `#E8695C` | 6.03 | 5.54 | 4.78 | 4.85 |
| brand `#F26B3A` | 6.34 | 5.82 | 5.02 | 5.09 |

**Zero failures.** Re-run this before changing any value — the ink/muted/faint
figures shift with the surfaces.

## Typography

- **Display: Archivo** (variable, weight + width axes) — replaces Bricolage
  Grotesque. A rationalist grotesque built for legibility in dense settings,
  which is what board silkscreen is for. The width axis means one file covers
  normal and condensed. Deliberately not Space Grotesk / Inter / a high-contrast
  serif, all of which currently read as AI-default.
- **Body: Hanken Grotesk** — unchanged, already self-hosted.
- **Data: JetBrains Mono** — unchanged, already self-hosted. Every figure and
  every designator is mono.

**The character comes from the treatment, not a loud face:** section labels are
condensed, uppercase and wide-tracked — the silkscreen voice.

⚠️ **Fonts must be self-hosted.** They were moved off `fonts.googleapis.com`
deliberately; putting them back reintroduces a GDPR problem and breaks two CSP
tests. Archivo must be subset to latin + latin-ext `.woff2` in `public/fonts`,
matching the existing pattern, and registered in `src/fonts.css`.

**Payload:** Bricolage is `105 KB` of the current `200 KB` — over half the font
budget, for display only. Archivo is expected to be at or below that, but the
real figure must be measured at implementation time, not assumed.

## The signature — connectors as slots

Every part slot is drawn as the connector that part actually plugs into:

- its **real keying notch** in the right place,
- its **reference designator** (`PCIEX16_1`, `DIMM_A2`, `M2_1`, `ATX_PWR`, `CPU_1`)
  in mono/`--tech`,
- **empty** renders as an open socket — dashed edge, dark inset — so a missing
  part reads as a hole in the build rather than as another grey row,
- **filled** seats into it with a `--gold` rail.

The designators are structure that encodes something true — *which slot the part
goes in* — rather than decoration. This is where the design's boldness is spent;
everything around it stays quiet.

## Scope

**In:**

- `src/index.css` `:root` tokens and `tailwind.config.js` semantic mappings
- `src/fonts.css` + `public/fonts` (Archivo in, Bricolage out)
- `src/lib/uiTokens.js` — `PANEL`, `PANEL_STRONG`, `BTN_PRIMARY`, and the
  `ELEV_*` / `RAIL_ACTIVE` tokens added by the Instrument pass
- the part-slot component used by the build list, which gains the connector
  treatment
- the wordmark
- the ~184 non-wordmark `accent` call sites (see below)

**Out, explicitly:**

- page structure, routing, the `flow` state machine
- the perf engine and every number it produces
- the 3D scene's geometry (its *lighting* is a risk, see below, but no geometry
  changes)
- the full board-map layout — explored, deferred, not part of this
- the Instrument pass — it survives unchanged in shape; only its colours move

## The accent migration is semantic, not mechanical

**185 `accent` class usages across 34 files. Exactly one is the wordmark.**

| class | count |
|---|---|
| `text-accent` | 84 |
| `border-accent` | 50 |
| `bg-accent` | 18 |
| `bg-accent-soft` | 16 |
| `text-accent-ink` | 16 |
| `ring-accent` | 1 |

Reserving orange for the wordmark means **reclassifying the other 184 sites**,
and each needs a judgement rather than a substitution:

- **action** (primary buttons, "Build it for me", Apply) → `--copper` + `--accent-ink`
- **seated / selected** (`border-accent`, `bg-accent-soft`, selected chips and
  cards) → `--gold` + `--gold-soft`
- **technical labelling** (designators, spec labels) → `--tech`

A find-and-replace here would be wrong and would look it.

**Guard:** once migrated, add a test asserting that `accent` classes appear only
in the wordmark component — the same shape as `tokenOpacity.test.js`, which
exists precisely because a silently-wrong class is invisible in review.

## Guard rails and risks

- ✅ **`paletteContrast.test.js` is now an EXTENSION, not a rework.** Because
  ink/muted/faint keep their values, its existing assertions and its hierarchy
  check survive; the surfaces move slightly and the figures above are the new
  expected values. What it must *gain* is coverage of the tokens it never
  tested — the metals, the signal trio and `--gold-soft` — since those are all
  used as text and none of them were pinned before.
- ⚠️ **Its contrast function must stay calibrated.** It linearises channels
  rather than averaging raw sRGB bytes, which is the usual silent error. Do not
  "simplify" it; the figures in this spec were computed the same way and will
  disagree with a naive implementation.
- ⚠️ **`tokenOpacity.test.js` still applies.** Every new token must be a whole
  token; `bg-gold/60` emits no CSS on this palette. `--gold-soft` exists as a
  separate token for exactly this reason — it is what `bg-accent-soft` was.
- ⚠️ **The 3D scene was lit against `#0F1114`.** The ground barely moves
  (`#0E0F11`) but the scene must be looked at afterwards. Budget the WebGL
  reloads; context is exhaustible.
- ⚠️ **`--faint` has no proposed value yet** and has 31 call sites.
- The suite is **126 files / 1248 tests** green today. Any test asserting a
  colour class by name will move with the tokens.

## Sequencing

1. **Tokens + wordmark.** Lands the identity everywhere at once and is judgeable
   in a single screen. Includes the `paletteContrast` rework.
2. **The accent migration**, classified by meaning, with its guard test.
3. **Connector slots** — the signature.
4. **Sweep** for anything the new palette strands, the 3D scene included.

Each stage is independently judgeable in the app, which is the point.

## Open questions

Two of the three original open questions were closed by measurement while
writing this spec:

1. ~~`--faint` needs a derived value~~ — **closed. It does not change**, and
   neither do `ink` or `muted`. All three pass on the new surfaces with the
   hierarchy intact.
2. ~~`--gold-soft` value to be derived~~ — **closed: `#2A2416`**, measured to
   carry ink, muted, faint, gold and every signal at AA.
3. **Still open: Archivo's real subset size**, to be measured not assumed.
   ⚠️ Downloading the font file needs the user's explicit go-ahead at
   implementation time — it is not something to do unprompted. Bricolage is
   105 KB of the current 200 KB, so that is the number to beat.

## What this spec deliberately does NOT decide

- **The full board-map layout.** Explored and shown; deferred by choice. If it
  is ever revisited, the open question is whether it earns its place beside the
  existing 3D view — the argument for it is that they are the schematic and the
  object, which is the pair engineers actually use.
- **Whether density gets attacked structurally.** Connectors-as-slots improves
  how a slot *reads* but does not reduce how much is on screen. "Too dense" was
  one of the four stated drivers and this spec only partly answers it; the board
  map was the option that answered it fully.
- **Anything about the Peripherals, Summary or site pages** beyond inheriting
  the new tokens.
