# Site audit — 2026-10-10

Scope: the live site (custompcbuilder.netlify.app), `main` at `7e1d68e`, and
the Claude memory for this project. Nothing in the repo was changed by the
audit.

## Baseline (all green)

| check | result |
|---|---|
| `npm run lint` | clean |
| `npx vitest run` | 153 files, 1650/1650 |
| `npx playwright test` | 101/101 (app + csp) |
| `npm run build` | clean; 7 pre-rendered pages + 539 part pages |
| `npm run catalog:check` | parts 554, peripherals 119, games 22 — in step |
| live console, £1,700 build with 3D loaded | only the known `THREE.Clock` and shader-precision warnings |
| live layout at 375px | no horizontal overflow |
| security headers / CSP / share-code hardening | sound; nothing to change |

## Findings

### F1 — high — Opening a share link wipes the visitor's own build

`applyShareLinkFromUrl()` (`src/lib/shareLink.js`) writes the decoded build
straight into the persisted store before first render. Verified live: a
9-part build in localStorage became the shared 1-part build, with no prompt
and no way back.

Fix: if the visitor already has parts, ask before replacing (or offer "save
mine first"), or open the shared build without overwriting the stored one.

### F2 — high — Persisted builds never pick up catalogue changes

`useBuilderStore` persists whole part objects. Nothing re-resolves them by id
against the current catalogue, so a returning visitor's build keeps the
prices, specs and compatibility fields from whenever each part was picked.
Every correction from the catalogue research (43 case values, 16 cooler socket
lists, the RTX 4090 length, …) is invisible to anyone with an older build in
progress, and the checks run on the old values. Deleted parts (e.g. the
phantom `cpu-ryzen-9-9900`) stay in those builds indefinitely. Saved builds
are fine — they store ids and re-resolve on load.

Fix: one function that maps `selectedParts`/`selectedPeripherals` to current
catalogue objects by id, run after hydration and again when `loadCatalog()`
lands; drop ids that no longer exist and tell the user.

### F3 — high — Every part URL redirects to a page that disowns it

```
/parts/gpu-rtx-4090   → 301 → /parts/gpu-rtx-4090/
/parts/gpu-rtx-4090/  → 200, <link rel="canonical" href=".../parts/gpu-rtx-4090">
```

`apply-prerender.mjs` writes each part as `dist/parts/<id>/index.html`, a
directory index. Netlify serves an existing file before consulting
`_redirects`, so the `/parts/:id → /parts/:id/index.html 200` rewrite never
runs and Netlify adds its trailing-slash 301. The sitemap (539 part URLs)
and each page's canonical point at the unslashed URL, so search engines get a
canonical that redirects to a page whose canonical is the redirect.

Fix (smallest): write `dist/parts/<id>.html` instead and change the rewrite
to `/parts/:id /parts/:id.html 200` — no file exists at the unslashed path, so
the rule applies and the URL serves 200 with no redirect. Then update the stale
comments in `pageMeta.js` and `build-sitemap.mjs`. Verify on the deploy
preview with curl, not a browser.

### F4 — medium — Share recipients and the Back button

- A first-time visitor opening a share link lands on the hub showing "Carry on
  building", not the shared build (`flow` stays `hub`).
- `flow` lives only in the store, so the browser Back button can't go
  builder → setup → hub; from the builder it walks back through tab hashes and
  then leaves the site. Matters most on phones.

Fix: set `flow: 'builder'` (and `#build`) when a share link is applied; push a
history entry when `flow` changes and restore it on `popstate`.

### F5 — medium — Summary and Build tab disagree about thermal paste

Build tab: "9 of 9 essentials chosen · All essentials covered · Thermal Paste
Optional". Summary tab, same build: "CORE BUILD · 1 part missing" and
"⚠ Not selected". `BuildSummary.jsx:127` counts `CATEGORIES` (includes paste)
where `SelectedPartsPanel` uses `countEssentials()`.

Fix: use `countEssentials(selectedParts).missing.length`, and render the paste
row as optional.

### F6 — medium — Peak power and cooling use base TDP

`perfEngine/power.js` puts the CPU at `tdp × 0.95` in "peak", and the cooling
panel and cooler warning use `tdp` as heat output. `tdp` is base power by
design, so for an i7-14700KF the site shows 125 W of heat and a 220 W cooler
as "comfortable, +76%"; Intel's Maximum Turbo Power for that chip is 253 W,
which most boards run indefinitely. The same number sizes the recommended PSU
and auto-build's PSU choice. AMD's PPT is ~1.35× TDP.

Fix: a researched `maxPowerW` per CPU (Intel Maximum Turbo Power, AMD PPT),
sourced to the standard, used for peak/cooling/PSU sizing while `tdp` stays
base for everything else. 79 rows of research.

### F7 — medium — Auto-build's case and RAM choices

`buildForUseCase` across budgets:

| use case | budget | build total | case |
|---|---|---|---|
| gaming | £900 | £877 | Kolink Observatory Lite £44.99 |
| gaming | £1,700 | £1,644 | Kolink Observatory Lite £44.99 |
| gaming | £3,800 | £3,553 | Kolink Observatory Lite £44.99 |
| streaming | £3,800 | £3,561 | Kolink Observatory Lite £44.99 |

RAM for gaming: £1,200 buys 48 GB DDR5-6400 (£149.99), £1,700 buys 64 GB
DDR4-3200 (£99.99), £2,500 buys 64 GB DDR5-6400 (£209.99). Swapping each for a
32 GB kit costs one point of overall score. Causes: `partQuality` rates a case only on GPU and
cooler clearance, and case/board/fans are scored relative to the rest of the
build, so the cheapest roomy case already scores 100; RAM adequacy keeps
rising past 32 GB for gaming.

Fix is a calibration decision: e.g. cap gaming/streaming RAM adequacy at
32 GB, and give case quality something beyond clearance (radiator support and
expansion slots are already researched). Re-run the budget × use-case sweep
before and after.

### F8 — low — Three different draw numbers

Same build: Summary "Draw 463 W" (sum of TDPs, also used by the PSU checks);
Performance "Gaming 359 W", "Peak 457 W". Label the summary figure as rated
draw or show the power-model figures there too.

### F9 — low — Setup budget input

No upper bound (`1e12` is accepted; the share codec already clamps at 1e7),
and £150 is accepted without saying the cheapest complete build is ~£421 —
the result banner then says "uses £421 of your £150 budget". Clamp like the
codec and show the floor under the field.

### F10 — low — Retailer search repeats the brand

`searchUrl(name, brand)` builds `"Intel Intel Core i3-12100F"` because names
already start with the brand. Skip the brand when the name starts with it.

### F11 — low — Soft 404s

Unknown paths return the SPA shell with 200 and the root canonical, and show
the hub. The canonical limits the SEO damage; a "page not found" view would
help users.

### F12 — low — Dependencies

`npm audit`: 15 findings. One reaches production code: `fflate` 0.6.10 via
drei → three-stdlib (`unzipSync` loop on a malformed ZIP64) — the app never
unzips user input, so it is not reachable. The rest are build/test-time
(tailwind 3's chokidar/braces/micromatch, vitest, undici via jsdom); `npm audit
fix` (non-breaking) clears most. Minor versions are available for vite (8.3),
r3f (9.8.1 — check whether it moved off `THREE.Clock`), react 19.3,
lucide-react, playwright. Tailwind 4, jsdom 30 and vitest 5 are majors.

### F13 — low — Stale text and housekeeping

- Comments claiming part pages "resolve through the SPA fallback":
  `src/lib/pageMeta.js:50`, `scripts/build-sitemap.mjs:58`.
- `src/main.jsx:7` mentions `BudgetEntry` (deleted); `useBuilderStore.js:43`
  is an orphan comment about a removed hover field.
- README: "parts over budget are locked" — they are hidden above 60% of the
  budget (`partFilter.js`), not locked.
- `src/lib/perfEngine/computerbase.js` is imported only by its test.
- Merged branches `claude/frosty-rhodes-767ce5` (+ its worktree),
  `feat/fans-paste-catalogue-research`, `feat/storage-catalogue-research`;
  remote `feat/ram-box-panels`; `refs/backup/pre-ui-scrap`.

## Not findings (checked, fine)

CSP, HSTS, frame/referrer/permissions headers; share-code decoding (length
cap, key allow-list, budget clamp); feedback path (no personal data, DB rate
cap); Supabase catalogue payload is ~19 kB gzipped; entry bundle 148 kB gz,
3D and Performance are lazy; phone layout; paste part URLs 404 by design.

## Code-style note

Many files carry long change-history comments ("this used to…", measured
pixel values, who decided what). `BuilderScreen.jsx` is 274 lines, most of
them comment. Git already holds that history; trimming comments to the
current *why* when a file is next touched would make the code faster to read
for people and models alike. A suggestion, not a defect.

## Memory

The Claude memory for this project was rewritten the same day: the 1,161-line
`pc-builder-project.md` became a ~120-line current-state file, nine
per-category research files were folded into one field guide, and 17
superseded files moved to `memory/archive/`. The memory had also recorded F3's
rewrite as "confirmed live"; it now records what the live site actually does.
