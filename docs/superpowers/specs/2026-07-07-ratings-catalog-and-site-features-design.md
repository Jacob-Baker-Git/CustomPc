# Ratings fine-tuning, catalog expansion & real site features — Design

Date: 2026-07-07
Status: Approved (pending spec review)

## Goal

Four related upgrades to the CustomPc app:

1. **Fine-tune the use-case ratings** so scores reflect both how well each part suits
   the task *and* how well the parts work **together** (real pairwise/system synergy,
   not just a CPU↔GPU bottleneck).
2. **Add ~60 more real components** to the catalog (Supabase DB + JSON snapshot).
3. **Prebuilds route through use case**: the ready-made tiers become *budget presets*
   that carry the budget into the use-case step, so a £900 gaming build ≠ £900 office.
4. **Add real site pages**: Feedback (stored in Supabase), Help/FAQ, Parts browser,
   and a Glossary / buying guide — reachable via a lightweight hash router.

Build order is phased and independent: **1 ratings → 2 catalog → 3 prebuild → 4 pages.**
TDD throughout.

---

## 1. Ratings logic — a real "work together" synergy layer

### Current model (`src/lib/partRatings.js`)

`rateBuild(parts, useCase, catalog)` scores each present part as
`score = min(adequacy, balance)`:

- `adequacy = clamp(100 · level / expect[cat])` — level is `partLevel` (catalog
  percentile of `partQuality`), `expect` is the per-use-case target in
  `buildProfiles.js`. **This stays.**
- `balance` — the weak part. Only CPU/GPU get a real signal (from
  `computeBottleneck`); every other part is compared to the build's *average* level
  `D`, which models no actual pairing.

### Change: replace `balance` with an explicit synergy layer

New module `src/lib/partSynergy.js`:

```
partSynergy(parts, category, useCase, catalog) → { balance: 0–100, reason: string | null }
```

Each category's `balance` comes from concrete checks, and the module returns a
plain-English `reason` when a pairing is what's holding the part back. `rateBuild`
then uses this as the `balance` term and stores `reason` on each part row so the
dashboard can show **why** a part is limited — the visible payoff of the "together" work.

| Category | Synergy check | Reason example |
|---|---|---|
| **cpu** | Bottleneck balance, **softened** (see below) | "Bottlenecks the RTX 5090 in gaming" |
| **gpu** | `min(`bottleneck balance softened`,` VRAM vs use-case target`)` | "8GB VRAM is tight for 4K creation" |
| **ram** | Capacity vs use-case `needs.ramGb` | "16GB — creation wants 32GB+" |
| **storage** | `min(`capacity vs `needs.storageGb`,` type factor`)` (HDD penalised for gaming/creation) | "A slow HDD holds back load times" |
| **psu** | Headroom = `wattage ÷ (systemDraw · 1.3)` | "Little headroom over a 450W GPU" |
| **cooler** | Cooling capacity (W) vs `cpu.tdp` | "Undersized for a 170W CPU" |
| **motherboard / case / fans** | Keep vs-build-tier balance (`100·level/D`); `reason: null` | — |

**Decision 1 (approved: soften).** The bottleneck term for the *limited* part is
passed through `soften(pct) = round(25 + 0.75·pct)` — so 0→25, 100→100. A CPU behind
a far-stronger GPU reads ~25–30 (clearly the weak link, but not "worthless", since it
still runs). The non-limited part stays 100. VRAM/RAM/PSU/cooler/storage factors are
plain `clamp(100 · have / target, 0, 100)` ratios (capped at 100 — exceeding target
gives no bonus).

**Missing-data principle (important):** if the field a check needs is absent
(`gpu.specs.vram`, `cooler.specs.height/radiator`, `storage.readMbps`, a part with no
`tdp`, etc.), that check returns **100 with no reason** — never a penalty for missing
catalog metadata. This also keeps the existing minimal test fixtures valid.

**Final per-part score** stays `min(adequacy, balance)`. `out[cat]` gains a `reason`:
`balance < adequacy ? synergy.reason : (adequacy < 70 ? "Underpowered for <label>" : null)`.
`isWeakLink` stays `score < 70`.

### Helper specifics (in `partSynergy.js`)

- `systemDrawW(parts)` = sum of `part.tdp` over present parts (GPU/CPU dominate).
- `coolerCapacityW(cooler)`: AIO by radiator mm (120/140→160, 240→220, 280→260,
  360→320); air by `height` mm (<120→80, ≥120→130, ≥145→180, ≥160→220).
- Use-case **needs** table added to each profile in `buildProfiles.js` alongside
  `weights`/`expect`: `needs: { ramGb, storageGb, vram }` — e.g. gaming
  `{ram:16, storage:1000, vram:8}`, creation `{ram:32, storage:2000, vram:16}`,
  programming `{ram:32, storage:1000, vram:6}`, office `{ram:16, storage:500, vram:2}`,
  streaming `{ram:32, storage:1000, vram:8}`. (Tunable in one place.)

### Tests

- New `src/tests/partSynergy.test.js`: each rule, the missing-data-no-penalty rule,
  and the softening floor (limited part ≥ 25).
- `src/tests/partRatings.test.js`: keep the existing intents (weak CPU behind strong
  GPU scores below it; low RAM is a weak link for creation; strong balanced build
  ≥ 70), adjusting thresholds to the new model and adding a case that asserts a
  `reason` string surfaces for a held-back part.

---

## 2. Catalog expansion

Add **~60 real, correctly-spec'd parts** across all 10 categories (~+6 each), keeping
the existing object shape and the `perfScore` scale (RTX 4090 = 100, Ryzen 9 7950X = 98).
`modelPath` reuses the per-category `/models/*.glb`.

- Source of truth for shape: `src/data/partsData.json`. New parts appended there.
- **Live Supabase DB kept in sync**: inserted into the `parts` table (project
  `igeggndtnmdpauxovnwv`, columns `id, name, category, price, data jsonb`) via a
  migration run through the Supabase management tools. Verify **row count** and
  **price-sum** match JSON after insert (the project's existing DB≡JSON discipline).
- `src/tests/partsCatalog.test.js`: bump the pinned per-category minimums to the new
  counts.

Peripherals/games are out of scope for this pass.

---

## 3. Prebuilds → use case

The ready-made tiers become **budget presets**, not instant builds.

- `src/lib/tiers.js`: `TIERS` keeps `{ id, label, budget }` and drops `useCase`;
  `partsForTier` is removed (no instant build).
- `src/components/BudgetEntry.jsx`: a tier chip now `setValue(budget)` **and advances
  to step 2 (use case)** instead of `applyTier`. The user then picks the use case and
  presses Generate — so £900 gaming ≠ £900 office. `applyTier` is deleted.
- Labels reframed as budget presets (e.g. "Entry · £900", "Mid · £1700",
  "High-end · £3800").
- Tests: `src/tests/tiers.test.js` and `src/tests/BudgetEntry.test.js` updated — a tier
  click lands on the use-case step with the budget prefilled; generating for two
  different use cases at the same budget yields different builds.

---

## 4. Site pages + routing

### Routing (Decision 2, approved: tiny hash router)

No new dependency. New `src/hooks/usePageRoute.js` reads `window.location.hash` and
recognises the content routes `#/help`, `#/parts`, `#/glossary`, `#/feedback`
(the builder's existing single-word `useHashView` hashes like `#build` are untouched).
It exposes `page` (`'help' | 'parts' | 'glossary' | 'feedback' | null`) and
`navigate(page | null)`.

`App.jsx` evaluation order:

1. If `page` is set → render that page inside a shared `SiteChrome` wrapper (slim top
   bar with the logo + a **Back** that clears the hash, and a `SiteFooter`).
2. Else if `budget > 0` → `BuilderScreen` (unchanged).
3. Else `flow` routing → `MainMenu` / `BudgetEntry` / `UpgradeWizard`.

Because content pages sit above the builder branch and Back just clears the hash,
opening (say) Feedback mid-build and pressing Back returns to the in-progress build
(store state persists) — no state juggling.

`MainMenu` gains a `SiteFooter` with links (Help · Parts · Glossary · Feedback); the
builder `TopBar` gains a single unobtrusive Feedback link.

### 4a. Feedback (Supabase-backed)

New Supabase table `feedback` (migration on the live project):

```
id         uuid primary key default gen_random_uuid()
created_at timestamptz not null default now()
rating     int  check (rating between 1 and 5)          -- required by the form
type       text check (type in ('bug','idea','praise','other'))
message    text not null check (char_length(message) between 1 and 2000)
email      text check (email is null or char_length(email) <= 200)
```

RLS **enabled**; a single policy allows `anon` **INSERT** only
(`with check (char_length(message) between 1 and 2000)`). **No SELECT policy** — the
public key can write feedback but cannot read anyone's; entries are read in the Supabase
dashboard. (Deliberately different from the SELECT-only catalog tables.)

- `src/lib/feedback.js`:
  - `validateFeedback({ rating, type, message, email }) → { ok, errors }` (rating 1–5,
    message 1–2000 chars, email optional but must look like an email if present).
  - `submitFeedback(input)` → `fetch` POST to `${SUPABASE_URL}/rest/v1/feedback` with
    the publishable key headers + `Content-Type: application/json` +
    `Prefer: return=minimal`; resolves on 2xx, throws on failure. Reuses the URL/key
    from `supabaseCatalog.js` (exported for reuse).
- `src/components/FeedbackPage.jsx`: 1–5 star rating, type select
  (Bug / Idea / Praise / Other), message textarea (live char count), optional email,
  a hidden honeypot field `company` (if filled, silently succeed without POSTing),
  plus submitting / success / error states. Client-side `validateFeedback` gates submit.
- Tests: `src/tests/feedback.test.js` (validation + honeypot short-circuit + payload
  shape); a `FeedbackPage` render/interaction smoke test with `submitFeedback` mocked.

### 4b. Help / FAQ — `src/components/HelpPage.jsx`

Static content (data array of `{ q, a }` rendered as `<details>` accordions): how the
budget builder picks parts, what the use-case ratings/synergy mean, the upgrade tool,
compatibility rules, and the pricing/data disclaimer (estimates, "July 2026" stamp).

### 4c. Parts browser — `src/components/PartsBrowser.jsx`

Read-only view of the whole catalog from `useCatalogStore`. Category filter tabs
(incl. "All"), a search box (name/brand), and a sort control (Price ↑/↓, Performance,
Name). Pure logic extracted to `src/lib/browseParts.js`
`browseParts(parts, { category, query, sort }) → Part[]` (unit-tested). Each result is a
compact read-only card: name, brand, a key spec line, price, and a "View on Amazon"
link via the existing `retailerLinks`. Tests: `src/tests/browseParts.test.js`.

### 4d. Glossary / buying guide — `src/components/GlossaryPage.jsx`

Static content from a small `src/lib/siteContent.js`: a glossary of terms
(VRAM, TDP, socket, form factor, NVMe, AIO, …) and a per-category "how to choose" tip.
Anchor nav to jump to a category.

---

## Out of scope

- Reading/moderating feedback in-app (read it in the Supabase dashboard).
- Server-side spam/rate-limiting beyond client validation + honeypot.
- TypeScript migration, live pricing feeds, peripherals/games expansion, react-router.

## Testing summary

New: `partSynergy.test.js`, `feedback.test.js`, `browseParts.test.js`, plus render
smoke tests for the new pages. Updated: `partRatings.test.js`, `tiers.test.js`,
`BudgetEntry.test.js`, `partsCatalog.test.js`. The existing Playwright E2E is unaffected.
