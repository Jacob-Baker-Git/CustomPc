# Site audit — 2026-10-17

Scope: local `main` (e896f46, built and served with production headers via
`npm run preview:csp`), the live site (custompcbuilder.netlify.app, a572ffa) for
headers and exposure, and the live Supabase project. Desktop 1366 px and phone
375 px. Nothing in the app was changed by the audit.

All 13 findings of the 2026-10-10 audit are fixed (c5e5d54 and follow-ups).

## Baseline (all green)

| check | result |
|---|---|
| `npm run lint` | clean |
| `npx vitest run` | 159 files, 1682/1682 |
| `npm run build` | clean; 7 pages + 539 part pages; GLBs 11.08 → 5.87 MB |
| `npm audit` | 0 vulnerabilities |
| console errors, 14 screens × 2 widths | none (404 page logs its own 404, expected) |
| horizontal overflow at 375 px | none |
| one `<h1>` per page, `lang="en"`, heading order, image `alt` | all pass |

## Findings

### A1 — high — Share links can put any part in any slot

`decodeBuild()` (`src/lib/buildCodec.js`) checks the slot name and that the id
exists, but not that the part belongs to that slot. Verified: a hand-made link
put an RTX 4090 in the CPU, motherboard, case, PSU and monitor slots; the site
showed it as a normal build, **score 96, "Excellent for Gaming"**, £7,350.
Saved builds use the same decoder. Anyone can send such a link.

Fix: `if (part && part.category === cat)` in both loops of `decodeBuild`
(peripherals also carry `category`). Same check in `resolveById`
(`useBuilderStore.js:9`), which re-resolves stored builds — that one is
self-inflicted only (editing your own localStorage), so low on its own.

### A2 — high — Game builder gives a £1,500 PC a hard drive and one RAM stick

Build for a game → Cyberpunk 2077, 1440p, £1,500 → Ryzen 5 9600 + RTX 5080 +
**WD Blue 1 TB HDD** + **one 16 GB DDR5-4800 stick** + A620 board.
`completeBuild()` (`gameTargetBuilder.js:42`) takes the cheapest part meeting
`capacityGb` needs, and the cheapest ≥1 TB drive is an HDD (£36.99; every
1 TB SSD costs more). A single stick runs single-channel, a real gaming loss.
The Summary then calls storage "your weakest part".

Fix (a calibration call): require an SSD for the boot drive (`specs.type` /
interface) and two sticks (`specs.sticks >= 2`) in `completeBuild`'s filter;
re-run the budget × game sweep before and after.

### A3 — medium — "Best next move" can suggest a pointless swap

Same build: "Swapping it for Seagate Barracuda 1TB HDD takes it from 50 to 51
for +£3" — one HDD for another. The suggestion should need a meaningful gain
(e.g. ≥ 5 points) or prefer a different storage type.

### A4 — medium — Part pages under-state PSU size

`psuFor()` (`src/lib/partPages.js:96`) = GPU watts × 1.6, rounded to 50 W, "for
the whole build" — no CPU allowance. RTX 4090: site says ~750 W, NVIDIA's
page says **850 W required system power** (checked 2026-10-17). It is worst on
mid cards: an RTX 4070 (200 W) gets "about 350 W" where NVIDIA lists 650 W.
Visitors following this would buy an undersized PSU.

Fix: base it on the GPU plus a typical CPU (or the builder's own PSU sizing
from `partSynergy.peakDrawW`), or show the maker's figure where researched.

### A5 — medium — Dialog keyboard handling

- **Save build** dialog: Tab leaves the dialog into the page behind, and
  Escape does not close it.
- **Part selector**: focus stays on the slot button when it opens (it takes
  ~40 Tabs to reach the dialog); on close focus lands in the top bar instead
  of returning to the slot.
- No dialog traps focus (ConfirmDialog, SavedBuilds delete,
  PeripheralFilterPanel same pattern).

Fix: one small shared hook — focus the first control on open, keep Tab
inside, Escape closes, restore focus to the opener on close. Or the native
`<dialog>` element with `showModal()`, which does all four.

### A6 — medium — Top-bar budget has no upper bound

`TopBar.jsx:31` accepts any number > 0; `1e300` renders as "£1e+300". The
setup screen and share codec already clamp to `MAX_BUDGET` (1e7). Clamp the
same way here. Escape also does not cancel the edit.

### A7 — low — Text size

11 px text is widespread: builder top bar ("BUDGET", "POWER"), slot labels on
Build ("MOTHERBOARD", "CPU" …), Summary small print, the "Best next move"
body, peripheral counts; 11.5 px for "[ 75 games benchmarked ]". WCAG sets no
minimum, but 12 px is the usual floor and the earlier phone pass meant to
remove sub-12 text. Contrast is otherwise excellent: the only failure is the
decorative "|" in the top bar (1.84:1, exempt as decoration).

### A8 — low — Small targets (WCAG 2.2 AA 2.5.8, 24 × 24 px)

- Parts browser Amazon search icons: 15 × 15.
- Peripherals "Info" buttons: 36 × 23.
- Score info button: 20 × 20; "FRAME RATES @ 1440P →" link 17 px tall.
- Footer links are 16 px tall; they likely pass on the spacing exception, but
  padding them to 24 px removes the doubt.

### A9 — low — Stale text

- Privacy/Terms say **"Last updated 1 August 2026"**
  (`legalContent.js:33`), but the policy changed in substance on 26 August
  (34bdd23: Netlify and Supabase see visitor IPs; fcf39e4: the AI-built
  disclosure). Set it to 26 August 2026 (later edits were wording/styling).
- "Prices are curated estimates (September 2026)" — fine; the
  priceSnapshot test fires at four months.

### A10 — low — Small UX gaps

- Build for a game: a negative or empty budget silently disables "Find
  builds" with no message.
- On phones the active "04 Summary" tab is cut off at the right edge of the
  step row; scroll the active tab into view.
- Saved builds with a missing date show "Invalid Date" (only reachable by
  editing localStorage).
- A negative stored budget renders as "1486.41£" (also storage-tampering only).

## Checked and fine

- **Supabase**: security advisors empty; RLS on all three tables; `parts` and
  `peripherals` read-only; `feedback` insert-only with DB checks on rating,
  type and length plus a rate-limit trigger; no RPC functions anon can call.
  (Defence in depth: anon still holds UPDATE/DELETE/TRUNCATE *grants* on
  `feedback`; RLS blocks the first two and PostgREST cannot issue TRUNCATE, so
  revoking them is optional tidying.)
- **Exposure**: `/.env`, `/.git/config`, `/package.json`, `/src/…`,
  `/scratch/…`, `/docs/…` all 404 live; no source maps in `dist`; only the
  publishable Supabase key in the bundle (by design).
- **Headers (live)**: strict CSP, HSTS preload, X-Frame-Options DENY,
  nosniff, referrer and permissions policies.
- **Privacy claims hold**: the live site contacts only its own host and
  Supabase; no cookies.
- **XSS**: no `innerHTML`/`dangerouslySetInnerHTML`/`eval`; a saved-build name
  of `<img src=x onerror=…>` renders as text. External links carry
  `rel="noopener noreferrer"` or `noreferrer`.
- **Corrupt storage**: garbage JSON, null or string parts, unknown `flow` —
  the app falls back to the hub; no white screen.
- **Keyboard**: logical tab order, visible focus everywhere (browser default
  rings; nothing removes them), reduced-motion respected.
- **Impossible targets**: 9,999 fps says no build reaches it and shows the
  fastest.
