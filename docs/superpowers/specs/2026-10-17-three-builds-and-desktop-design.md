# Three builds per search, and a desktop layout — design

Date: 2026-10-17. Agreed with the user in chat the same day.

## Why

Two complaints from the user:

1. **"Find builds" gives one answer.** Fortnite, 1080p Epic, target 240 fps,
   £1,000 showed only "up to 364 fps · £999". A far cheaper build reaches 240 fps
   but is hidden, because `buildForGame` only computes `cheapestHit` when `best`
   misses the target. The user wants three answers every time: the best for the
   budget, the cheapest that hits the target, and a best-value middle.
2. **The site is a phone layout, stretched.** Not broken on a PC — just not
   designed for one. The Build, Performance and Summary tabs already use the
   width; the home page, "Build for a game", the part picker and the
   peripherals grid do not.

## Goals

- Every "Find builds" search answers with up to three distinct builds.
- On desktop (≥1024px, the existing `lg` / `DESKTOP_QUERY`), the home page,
  "Build for a game" and the part picker are laid out for a wide screen.
- The phone layout of every screen is unchanged.

## Non-goals

- The live 3D view beside the parts list on the Build tab (offered as item 2;
  the user did not pick it).
- Any change to the performance model, the catalogue or the CustomPC score.
- Hover cards on parts (also offered; folded out — see "Small fixes").

## Anti-goals

- A "middle" that is just the halfway price. The user was explicit: if an
  extra £50 for a better card isn't worth it, don't recommend it.
- Inventing a third option when there isn't a real one. Fewer cards with an
  honest sentence beats a padded set.
- AI-looking desktop design. The user rejects that (see the configurator
  redesign spec 2026-10-16): keep the existing tokens, type, hairline rows and
  yellow (`brass`) palette; no new card chrome, gradients or glow.

## Part A — three builds (`src/lib/gameTargetBuilder.js`)

All three are complete builds (every ESSENTIAL category) and are judged on the
FPS row the engine returns for the chosen game, preset and resolution.

### Best for your budget

- Pick the CPU + GPU pair exactly as today: walk the fastest-first ranking and
  take the first pair whose cheapest sensible completion (`completeBuild`)
  fits the budget.
- **New:** then spend what is left on the other parts. Call `autoBuild` with
  the pair (and nothing else) locked, the user's budget, `maximise: true` and
  `rateFor: 'gaming'`, over the same filtered catalogue `completeBuild` uses
  (≥16 GB in ≥2 sticks, no HDD boot drive, a cooler rated for the chip). The
  result must still be ≤ budget; if the maximise pass somehow overshoots, fall
  back to the plain `completeBuild` result.
- The FPS shown is the pair's row (other parts do not change the engine's
  answer).

### Cheapest that hits your FPS

- The lowest-total complete build whose row reaches the target — today's
  `cheapestHit` loop, but **always computed** when the target is reachable,
  not only when Best misses it.
- Other parts stay at the cheapest sensible level (`completeBuild`). Cheapest
  wins here.
- It may cost more than the budget; then it is shown marked "over budget".

### Middle ground — best value

- Only exists when Cheapest exists **and** is within budget, and Best is faster
  than Cheapest.
- Candidates: the price/FPS **Pareto frontier** of complete builds (cheapest
  completion of each pair) whose total lies strictly between Cheapest's and
  Best's totals and whose FPS lies strictly between theirs.
- Climb from Cheapest. At each point, look at every frontier point above it
  and take the one with the best ratio of `%fps gain / %price gain`, provided
  that ratio is ≥ `VALUE_BAR`. Repeat from there. Stop when no point above
  clears the bar. Looking at every point above (not just the next one) lets
  it jump a poor step to reach a good one further up.
- `VALUE_BAR = 1` (a named constant, the one knob): +5% price needs at least
  +5% fps. Example: £1,000 → £1,050 needs 150 → ≥158 fps.
- Where it stops is the Middle pair, completed with `completeBuild` only (no
  maximise pass), so its price reflects the value step, not padding.
- If the climb never leaves Cheapest, there is no Middle card; show the line
  "Nothing above the cheapest build is worth the extra money."

### Cooler filter fix (bug found while writing this)

`completeBuild` keeps only coolers whose `specs.ratedTdpW` covers the CPU's
TDP — but no cooler in the catalogue has `ratedTdpW`, so the filter passes
everything and a game build can pair a 250 W chip with an £18 tower. Replace it
with `coolerCapacityW(cooler) >= cpu.tdp` (base power — what the old filter
meant), keeping coolers whose capacity is unknown (0) only if nothing known
qualifies.

*Claude's call:* base power, not `cpuPeakW` (full boost). `coolerCapacityW`
caps every air cooler at 220 W and ~15 chips boost to 241–253 W, so the
full-boost rule would force a £65+ 360mm AIO onto every build with those
chips. Leave `buildWarnings.js:35` alone — it deliberately warns only on a
published rating, and changing it is a separate decision.

### Tie-break change

When two pairs have equal FPS, a measured row (`bound !== 'upper'`) ranks
above an "up to" ceiling, before the existing CPU-strength tie-break. Applies
to every ranking in the file.

### Edge cases (user-approved)

| Situation | Shown |
|---|---|
| Nothing reaches the target | Best + "The fastest manages X fps for £Y." No Cheapest, no Middle. |
| Cheapest is over budget | Best (misses target) + Cheapest (marked over budget). No Middle. |
| Best and Cheapest share the CPU + GPU but Best's other parts are better | Both shown (they are different builds). Best's header reads "+£X · same fps, better parts". *Claude's call.* |
| Two answers are the same parts | Shown once. Order of precedence: Cheapest, Middle, Best — the card keeps the first title and adds the other ("Cheapest that hits 240 fps · also the best within £1,000"). |
| No benchmark data | Today's message, unchanged. |

### Return shape

`buildForGame` returns `{ noData, unreachable, best, middle, cheapest, fastest,
noValueStep }` — `cheapestHit` is renamed `cheapest`; `noValueStep` is true when
Middle could have existed but the climb never left Cheapest. Each option keeps
today's `{ parts, total, fps, lowFps, basis, bound }`.

### Performance

The current worst case is ~2 s (completing every pair when the budget is below
every build). The frontier for Middle reuses the same memoised completions, so
it should add little. Measure after: if a desktop search takes > 500 ms in the
common case, say so before optimising. Not in scope to fix otherwise.

## Part B — "Build for a game" on desktop (`src/screens/TargetScreen.jsx`)

- **Phone (<1024px):** unchanged in structure; three cards stack in the order
  Cheapest, Middle, Best.
- **Desktop:** two regions. Left, a fixed-width column (~320px) holding the
  game settings, Target FPS, Budget and "Find builds", sticky while results
  scroll. Right, the results: three columns side by side, same order.
- Each column: title, FPS + price as today, "Use this build", then the full
  parts list **open** (not folded) on desktop.
- **Differences highlighted:** a part row is highlighted in a column when that
  category's part differs from the column to its left (Middle vs Cheapest,
  Best vs Middle). Highlight = the brass token as text/left rule, not a new
  colour. Each column header also shows the step over the column to its left:
  "+£210 · +38 fps over Cheapest" on Middle; Best compares with Middle, or
  with Cheapest when there is no Middle.
- Fewer than three answers: the existing columns take the space; the message
  for a missing card (e.g. no value step) sits where that column would be.
- Before the first search on desktop, the right region shows a one-line hint,
  not empty space.

## Part C — desktop home page (`src/components/MainMenu.jsx`)

- **Phone:** unchanged.
- **Desktop:** two columns inside a wider container (~1200px). Left: wordmark,
  headline, the games tag, the sentence, and the three path rows. Right: the
  existing `welcome-pc.webp` render, large and vertically centred, feathered
  into the page as today. No new image.
- The headline may go up a step in size at `lg`.

## Part D — part picker as a table on desktop (`src/components/PartSelector.jsx`)

- **Phone:** unchanged (the card grid).
- **Desktop:** the dialog grows to most of the viewport (≈ `max-w-6xl`,
  `max-h-[88vh]`) and shows a **table**: one row per part, a column per spec.
- Columns per category — built from fields the catalogue already holds (the
  same ones `specRows` / `partStats.js` read). Nothing invented:
  - CPU: name, price, perf score, perf per £100, cores, socket, TDP
  - GPU: name, price, perf score, fps per £100 (at the build's resolution),
    VRAM, length, TDP
  - Motherboard: name, price, socket, RAM type, form factor
  - RAM: name, price, capacity, sticks, type, speed
  - Storage: name, price, capacity, type, £ per GB
  - PSU: name, price, wattage, efficiency rating
  - Cooler: name, price, type, cooling capacity (est., `coolerCapacityW` —
    no part has a published rating), height
  - Case: name, price, max GPU length, max cooler height, fans in the box
  - Fans / paste: name, price, plus whatever spec fields they carry
  - A missing value shows "—".
- Click a column header to sort by it; click again to reverse. Keeps the
  existing search box. The sort dropdown goes on desktop (headers replace it).
- Incompatible / over-budget rows stay in the list, dimmed, with the reason on
  the row (today's lock reason). The selected part is marked.
- The "show pricier parts" behaviour is kept.
- Clicking a row selects it, exactly as clicking a card does today. Keyboard:
  rows are focusable; Enter selects.
- No filter sidebar (offered loosely in chat; sortable columns + search cover
  it — add a sidebar only if the user asks).

## Part E — small fixes

1. **Budget pill bug.** On the "What will my build get?" path the budget is 0;
   the top bar then shows `999.41000000000001£` and "£-999 left". Fix in
   `DynamicBars` (format £ with `toFixed(0)` and the £ first when there is no
   max) and hide the "£X left" figure in `TopBar` when the budget is 0.
2. **Peripherals grid** shows 4 per category in 3 columns, orphaning one. At
   `lg`, 4 columns (container wide enough to hold them).
3. **Keyboard shortcuts** in the builder: `1`–`4` switch the Build /
   Performance / Peripherals / Summary tabs; `/` focuses the search box when the
   part picker is open. Ignored while typing in any input. Desktop and phone
   alike (phones just never press them).

## Constraints

- Tailwind 4, existing tokens only (`brass`, `ink`, `muted`, `line`, `surface`
  …). No text under 12px, tap targets ≥24px (the 2026-10-17 audit's rules,
  which tests guard).
- Every modal keeps `useDialog`.
- `npm run prerender` after shared-UI changes (the home page is prerendered).
- Don't push; the user pushes.

## Left to the builder

- Exact column widths, sticky offsets and breakpoints above `lg`.
- Test split (unit tests for the three-build logic and the frontier/value
  climb; component tests for the table sort and the 1–4 shortcuts).
- Whether the picker table is its own component.
