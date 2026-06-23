# Catalog Refresh + Real `brand` Field — Design (2026-06-23)

Status: design approved in brainstorm; pending written-spec review.

## Context

Upgrade cycle 3, task #1 of the supplied checklist. The bundled catalog
(`src/data/partsData.json`, ~188 parts) is roughly a generation stale: it tops out
at Ryzen 7000 / Zen 4, RTX 40, RX 7000 and Intel 13/14th-gen. This cycle adds the
current generation (RTX 50, RX 9000, Ryzen 9000/Zen 5, Intel Core Ultra 200S) and
gives **every** part a real `brand` field (only the 5 thermal pastes have one
today), then makes the existing "Brand (A–Z)" sort use it and adds a brand filter
to the part-selection modal.

Stack unchanged: React 19 + Vite, Zustand (working build in-memory), R3F, Vitest
(163 passing, build clean). Data stays **bundled** static JSON — no runtime fetch.
This is treated as enhancement-in-place: existing field names, IDs, prices and
`amazon.co.uk` links are preserved.

### Decisions taken in brainstorming
- **perfScore scale** → *anchor-preserving*. Leave every existing `perfScore`
  untouched; new flagships score above 100 (the old "0–100" ceiling). User
  delegated this ("do what makes sense"); anchor-preserving is chosen as the
  low-risk path — see §1.
- **Breadth** → "as wide as makes sense": all four families incl. Ryzen X3D parts
  and Intel Arc B580, plus the LGA1851 enablement the Intel CPUs require, plus two
  current DDR5 kits. No bloat beyond a catalog a 2026 buyer would actually shop.
- **Last-gen parts** → *keep all as-is*, only add the `brand` field. No pruning,
  no re-pricing (a separate "indicative prices" disclaimer is on the roadmap).

## Goals

1. **perfScore stays sensible above 100** for new flagships, with the
   `fpsEstimate.js` comment corrected. No change to existing scores.
2. **~25 current-gen parts added** (19 CPUs/GPUs + 4 LGA1851 boards + 2 RAM kits)
   with correct socket / perfScore / tdp / price / length, mutually consistent with
   the existing relative ordering.
3. **LGA1851 enablement** so Intel Core Ultra 200S parts are actually usable
   (motherboards + cooler-socket update).
4. **`brand` on every part**, from the manufacturer token in the name.
5. **Brand filter** in the modal; "Brand (A–Z)" sort uses the real field.
6. Green throughout: new data-integrity + filter tests, existing suite stays green.

## Non-goals (YAGNI)

- No field renames; keep `tdp`, `length`, `maxGpuLength`, `specs.height`,
  `perfScore`, `socket`, etc.
- No `perfScore` rescale of existing parts (the considered-and-rejected
  alternative — it would shift FPS/value/tier/auto-build output app-wide and churn
  many tests for cosmetic range-tidiness).
- No re-pricing of last-gen parts; no pruning of existing parts.
- No `tiers.js` refresh to current-gen, no new coolers, no runtime fetch. (Tiers
  refresh flagged as a follow-up the user can greenlight.)
- No new GPU board-partner modelling — GPU `brand` is the chip vendor (see §4).

## Design

### 1. perfScore scaling — anchor-preserving
Every existing `perfScore` is unchanged. New parts are scored on the **same
relative ladder**, so current flagships exceed the old 100 ceiling
(RTX 5090 ≈ 132, Ryzen 9 9950X3D ≈ 106). This is safe because every consumer is
relative or heuristic, not absolute:
- `bottleneck.js` uses the CPU/GPU *ratio* — unaffected by absolute magnitude. A
  5090 + top CPU correctly reads CPU-limited at 1080p (realistic).
- `valueScore.js` and `autoBuilder.js` are relative (perf-per-£, sort by perf).
- `fpsEstimate.js` is an explicit heuristic (`perfScore × factor`); higher inputs
  yield higher FPS, still bounded by the CPU ceiling. **Action:** update its
  header comment from "0–100 perfScore scale" to note ~100 is the last-gen-flagship
  anchor and current flagships exceed it.

### 2. New CPUs & GPUs (19) — `src/data/partsData.json`
Indicative UK prices; perfScore on the existing relative ladder. All new parts
also carry `brand` (§4) and `modelPath` matching their category's existing value.
(LGA1851 motherboards are in §3; new RAM kits in §5.)

**GPUs — RTX 50 / NVIDIA / GDDR7** (`brand: "NVIDIA"`, `specs.memType: "GDDR7"`)
| id | name | price | tdp | length | perfScore | vram |
|---|---|---|---|---|---|---|
| gpu-rtx-5090 | NVIDIA GeForce RTX 5090 | 1899.99 | 575 | 357 | 132 | 32 |
| gpu-rtx-5080 | NVIDIA GeForce RTX 5080 | 999.99 | 360 | 340 | 93 | 16 |
| gpu-rtx-5070ti | NVIDIA GeForce RTX 5070 Ti | 729.99 | 300 | 300 | 86 | 16 |
| gpu-rtx-5070 | NVIDIA GeForce RTX 5070 | 539.99 | 250 | 250 | 70 | 12 |
| gpu-rtx-5060ti | NVIDIA GeForce RTX 5060 Ti 16GB | 399.99 | 180 | 245 | 55 | 16 |
| gpu-rtx-5060 | NVIDIA GeForce RTX 5060 | 289.99 | 145 | 200 | 46 | 8 |

**GPUs — RX 9000 / AMD / GDDR6** (`brand: "AMD"`, `specs.memType: "GDDR6"`)
| id | name | price | tdp | length | perfScore | vram |
|---|---|---|---|---|---|---|
| gpu-rx-9070xt | AMD Radeon RX 9070 XT | 579.99 | 304 | 287 | 80 | 16 |
| gpu-rx-9070 | AMD Radeon RX 9070 | 519.99 | 220 | 267 | 72 | 16 |
| gpu-rx-9060xt | AMD Radeon RX 9060 XT 16GB | 319.99 | 160 | 245 | 53 | 16 |

**GPU — Intel Arc / GDDR6** (`brand: "Intel"`)
| id | name | price | tdp | length | perfScore | vram |
|---|---|---|---|---|---|---|
| gpu-intel-arc-b580 | Intel Arc B580 | 249.99 | 190 | 270 | 43 | 12 |

**CPUs — Ryzen 9000 / Zen 5 / AM5** (`brand: "AMD"`, `socket: "AM5"`) — existing AM5 boards/coolers already fit
| id | name | price | tdp | perfScore | cores | boostClock |
|---|---|---|---|---|---|---|
| cpu-ryzen-9-9950x3d | AMD Ryzen 9 9950X3D | 699.99 | 170 | 106 | 16 | 5.7 |
| cpu-ryzen-9-9950x | AMD Ryzen 9 9950X | 549.99 | 170 | 103 | 16 | 5.7 |
| cpu-ryzen-7-9800x3d | AMD Ryzen 7 9800X3D | 449.99 | 120 | 100 | 8 | 5.2 |
| cpu-ryzen-9-9900x | AMD Ryzen 9 9900X | 399.99 | 120 | 94 | 12 | 5.6 |
| cpu-ryzen-7-9700x | AMD Ryzen 7 9700X | 329.99 | 65 | 84 | 8 | 5.5 |
| cpu-ryzen-5-9600x | AMD Ryzen 5 9600X | 229.99 | 65 | 74 | 6 | 5.4 |

**CPUs — Intel Core Ultra 200S / Arrow Lake / LGA1851** (`brand: "Intel"`, `socket: "LGA1851"`)
| id | name | price | tdp | perfScore | cores | boostClock |
|---|---|---|---|---|---|---|
| cpu-intel-ultra-9-285k | Intel Core Ultra 9 285K | 549.99 | 125 | 101 | 24 | 5.7 |
| cpu-intel-ultra-7-265k | Intel Core Ultra 7 265K | 379.99 | 125 | 90 | 20 | 5.5 |
| cpu-intel-ultra-5-245k | Intel Core Ultra 5 245K | 279.99 | 125 | 80 | 14 | 5.2 |

**Relative-ordering sanity:** 5080 (93) sits between 4080 (85) and 4090 (100);
5070 (70) ≈ 4070 Ti (72); 9070 XT (80) above 7900 XT (78), below 7900 XTX (88) and
4080 (85); Arc B580 (43) ≈ RX 7600 (42). 9800X3D (100) jumps +12 over 7800X3D (88)
and ties 14900K (100) on blended; 9950X3D (106) is the new top CPU; 285K (101) just
edges 14900K on MT-blended.

### 3. LGA1851 enablement (required — without it the Intel CPUs are permanently locked)
**4 new motherboards** (`category: "motherboard"`, `socket: "LGA1851"`,
`ramType: "DDR5"`, `modelPath: "/models/motherboard.glb"`), spanning form factors so
auto-build and varied builds can use them:
| id | name | brand | price | formFactor | chipset |
|---|---|---|---|---|---|
| mb-asus-z890-e | ASUS ROG Strix Z890-E Gaming WiFi | ASUS | 449.99 | ATX | Z890 |
| mb-msi-z890-tomahawk | MSI MAG Z890 Tomahawk WiFi | MSI | 289.99 | ATX | Z890 |
| mb-asrock-z890-pro-rs | ASRock Z890 Pro RS WiFi | ASRock | 219.99 | ATX | Z890 |
| mb-gigabyte-b860m | Gigabyte B860M Gaming X | Gigabyte | 169.99 | mATX | B860 |

**Cooler socket update:** append `"LGA1851"` to the `sockets` array of every cooler
that already lists `"LGA1700"` (LGA1851 retains LGA1700 cooler mounting). The
AM5/AM4-only low-profile Noctua NH-L9a stays Intel-incompatible, correctly. This is
the *only* edit to existing parts besides adding `brand`.

### 4. `brand` field on every part — `src/data/partsData.json`
Add `brand: "<Manufacturer>"` to all ~188 existing parts and every new one,
matching `partsData`'s existing inline-object shape (as the pastes already do).
The value is the manufacturer token from the name. Conventions:
- **CPU/GPU brand = the silicon vendor**, matching the name prefix: `AMD`, `Intel`,
  `NVIDIA`. (Board-partner brands like ASUS/Gigabyte are out of scope — there is one
  SKU per chip, so vendor is the meaningful filter axis.)
- **Multi-word brands preserved exactly:** `be quiet!`, `Cooler Master`, `G.Skill`,
  `Lian Li`, `Fractal Design`, `Thermal Grizzly`, `Thermalright`, `TeamGroup`.
- Per-category vendor sets (for reference; derived from current names):
  motherboard ASUS/MSI/Gigabyte/ASRock · ram Corsair/G.Skill/Kingston/Crucial/
  TeamGroup · storage Samsung/WD/Crucial/Seagate/Kingston · psu Corsair/be quiet!/
  EVGA/Seasonic/MSI/NZXT/Cooler Master/Thermaltake · case Fractal Design/NZXT/
  be quiet!/Cooler Master/Lian Li/Corsair/Phanteks/Montech · cooler Noctua/
  be quiet!/Cooler Master/Arctic/DeepCool/Thermalright/Corsair/NZXT · fans Arctic/
  Noctua/Corsair/Lian Li/be quiet!/Cooler Master/DeepCool/NZXT/Thermaltake.

Side benefit: `BuildSummary` already passes `part.brand` to `searchUrl`, so
"Find Best Price" links become brand-qualified for all parts, not just paste.

### 5. RAM additions (2) — current-gen relevance
| id | name | brand | price | ramType | speed | capacityGb | tdp |
|---|---|---|---|---|---|---|---|
| ram-gskill-ddr5-8000-32 | G.Skill Trident Z5 CK CUDIMM DDR5-8000 32GB | G.Skill | 199.99 | DDR5 | 8000 | 32 | 7 |
| ram-kingston-fury-ddr5-6400-32 | Kingston Fury Renegade DDR5-6400 32GB | Kingston | 139.99 | DDR5 | 6400 | 32 | 6 |

(`specs.sticks: 2`, `modelPath: "/models/ram.glb"`, matching existing RAM.)

### 6. Brand filter in the modal + sort
- **`src/lib/partFilter.js`** — extend signature to
  `filterParts(parts, selectedParts, budget, query, brand)`. New 5th arg is
  optional and backward-compatible (existing 4-arg callers/tests unchanged). When
  `brand` is truthy and not `'all'`, keep only `part.brand === brand`, applied in
  **both** the search branch and the default (compatible+budget) branch so the
  brand narrows results consistently.
- **`src/components/PartSelector.jsx`** — add a brand `<select>` next to the sort
  dropdown:
  - Options: `All brands` (value `'all'`) + the distinct `brand` values present in
    the current category, sorted A–Z, derived via `useMemo` from `parts`.
  - State `brandFilter`, default `'all'`. Because the modal is reused across
    categories, reset to `'all'` when `category` changes (the brand set differs per
    category) — via a `useEffect` on `category`.
  - Pass `brandFilter` as the 5th arg to `filterParts`.
- **`src/lib/sortParts.js`** — `brand-asc` already reads `brand ?? name`; add a
  name tiebreak so same-brand items stay name-ordered:
  `(a.brand ?? a.name).localeCompare(b.brand ?? b.name) || a.name.localeCompare(b.name)`.

## Risks & integration points
- **LGA1851 ripple is the main correctness risk.** New Intel CPUs need both a
  matching motherboard (added) and a cooler whose `sockets` include `LGA1851`
  (added via the socket update). A test asserts every LGA1851 CPU has ≥1 compatible
  board and ≥1 compatible cooler in the catalog.
- **perfScore > 100** must not break callers. Verified by reading all consumers
  (bottleneck/value/autoBuilder/fpsEstimate); all relative/heuristic.
- **`filterParts` 5th arg** is positional; confirm no caller passes a 5th arg today
  (only `PartSelector` calls it). Tests may pass `'all'`/omit safely.
- **Brand-filter reset on category change** — without the §6 `useEffect` reset,
  switching from CPU (AMD/Intel) to e.g. storage would leave a stale `brand` that
  matches nothing, giving an empty modal. The reset prevents this.
- **auto-build / tiers**: purely additive data; auto-build may now pick a
  current-gen part but stays compatible and within budget (its tests are
  structural). Tier IDs are untouched and still resolve.
- **JSON integrity**: ~188 hand-edited `brand` additions risk a typo/trailing
  comma; the data-integrity test + `npm run build` (Vite JSON parse) catch this.

## Testing
TDD throughout. Baseline 163 green.
- **`src/tests/partsData.test.js` (new)** — data integrity: every part has a
  non-empty string `brand`; the current-gen anchors exist (`gpu-rtx-5090`,
  `gpu-rx-9070xt`, `cpu-ryzen-9-9950x3d`, `cpu-intel-ultra-9-285k`, an LGA1851
  board); every part keeps required per-category fields; **every LGA1851 CPU has ≥1
  socket-compatible motherboard and ≥1 socket-compatible cooler**; all IDs unique.
- **`src/tests/partFilter.test.js` (extend)** — brand filter narrows to one brand;
  `'all'`/undefined returns the unfiltered set; brand + search combine.
- **`src/tests/sortParts.test.js` (extend)** — same-brand items fall back to name
  order.
- **`PartSelector` component test** — brand `<select>` renders the category's
  brands and filters the grid (add to existing modal/component test, or new
  `PartSelector.test.jsx` if none exists).
- Re-run full `npm run test:run` and `npm run build` — both green before done.

## Out of scope / follow-ups
Affiliate tag (task #2, next), multi-part slots (#3), deeper compatibility (#4),
GLB models (#5), OG image (#6), FPS depth (#7), quick wins (#8). Also flagged:
refreshing `tiers.js` "Ultimate" to a current-gen flagship build, and re-pricing
last-gen parts to 2026 street prices — both deferred unless greenlit.
