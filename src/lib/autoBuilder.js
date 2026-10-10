import { checkCompatibility } from './compatibility'
import { partQuality } from './partQuality'
import { rateBuild } from './partRatings'
import { usefulRamGb } from './buildProfiles'
import { peakDrawW, recommendedPsuW } from './partSynergy'

const BASE_WEIGHTS = {
  cpu: 0.18, gpu: 0.32, motherboard: 0.11, ram: 0.08, storage: 0.07,
  psu: 0.07, case: 0.08, cooler: 0.06, fans: 0.03,
}

// CPU/GPU first (perf drivers), parts that depend on them next, PSU last.
const FILL_ORDER = ['cpu', 'gpu', 'motherboard', 'ram', 'cooler', 'case', 'storage', 'fans', 'psu']
const PERF = new Set(['cpu', 'gpu'])
// Smallest score gain (on the 0-100 scale) the greedy pass will pay for.
const MIN_GAIN = 0.5

function weightsFor(resolution) {
  const w = { ...BASE_WEIGHTS }
  if (resolution === '4k') { w.cpu -= 0.06; w.gpu += 0.06 }
  else if (resolution === '1080p') { w.gpu -= 0.04; w.cpu += 0.04 }
  return w
}

// `legacy` parts are discontinued. They exist so the upgrade flow can say "this
// is what I already own", not so we can recommend them: you cannot go and buy a
// six-year-old card at anything like our recorded price, so a build containing
// one is advice that cannot be acted on. A part already in the selection is
// still honoured; this only governs what we reach for ourselves.
const ofCategory = (parts, c) => parts.filter((p) => p.category === c && !p.legacy)

// ⚠️ Wattage is NOT the only thing that makes a supply run a build. A unit can
// have watts to spare and still lack the plug the graphics card needs — an
// RTX 5080 wants a 16-pin, or three 8-pins through its bundled adapter, and a
// 650W Bronze unit with two PCIe heads has neither. Sizing on watts alone paired
// exactly that, and the build came out `blocked` by the app's own rule 1.
//
// So candidates are filtered through `checkCompatibility` first. That rejects
// only what the app would actually block: an `unverified` rule is compatible, so
// a supply whose connectors nobody has researched yet stays eligible and this
// stays a no-op for every PSU still missing `specs.connectors`.
//
// ⚠️ The filter can empty the pool — a build whose card no catalogue supply can
// feed must still come out with a power supply rather than none, so the
// unfiltered list is kept as a last resort.
//
// `peak` is peakDrawW: the CPU at full boost, not the base-power TDP sum, and
// the first choice is the size the Performance tab recommends for that peak.
function choosePsu(candidates, peak, remaining, selection = {}) {
  const byPrice = [...candidates].sort((a, b) => a.price - b.price)
  const usable = byPrice.filter((p) => checkCompatibility(selection, p).compatible)
  const pool = usable.length > 0 ? usable : byPrice
  const rec = recommendedPsuW(peak) ?? 0
  return (
    pool.find((p) => p.wattage >= rec && p.price <= remaining) ||
    pool.find((p) => p.wattage >= peak && p.price <= remaining) ||
    pool.find((p) => p.wattage >= rec) ||
    pool.find((p) => p.wattage >= peak) ||
    pool[pool.length - 1] ||
    null
  )
}

// Price of the cheapest PSU that could actually run a build peaking at `peak`
// watts, at the same recommended size choosePsu targets.
//
// This is what makes "can I afford this upgrade?" an honest question. The pass
// used to compare a swap's price difference against a PSU reserve fixed before
// any part was picked — so upgrading a £600 office build to a 300W graphics card
// looked affordable, then the PSU it now needed cost more than the reserve and
// choosePsu's last two fallbacks ignore `remaining` entirely. The build came out
// at 136% of budget. A step has to be priced with the power supply it drags
// along behind it.
//
// It prices only supplies the build could actually take - the same
// checkCompatibility filter choosePsu applies (a card's power connectors, a
// board's EPS header) - or it under-prices exactly the builds whose cheapest
// big-enough supply lacks the right plugs.
function psuPricer(candidates) {
  const byPrice = [...candidates].sort((a, b) => a.price - b.price)
  const cache = new Map()
  return (sel) => {
    const peak = peakDrawW(sel)
    const watts = Math.ceil(peak / 25) * 25
    const key = `${watts}|${sel.gpu?.id ?? ''}|${sel.motherboard?.id ?? ''}`
    if (!cache.has(key)) {
      const usable = byPrice.filter((p) => checkCompatibility(sel, p).compatible)
      const pool = usable.length > 0 ? usable : byPrice
      const fit = pool.find((p) => p.wattage >= recommendedPsuW(watts))
        || pool.find((p) => p.wattage >= watts)
        || pool[pool.length - 1]
      cache.set(key, fit?.price ?? 0)
    }
    return cache.get(key)
  }
}

// Head of a best-first pool, or a random one of its top k when an rng is given —
// keeps a varied build inside the best tier. Deterministic (head) without rng.
function pick(sortedBestFirst, rng, k = 3) {
  if (sortedBestFirst.length === 0) return null
  if (!rng) return sortedBestFirst[0]
  return sortedBestFirst[Math.floor(rng() * Math.min(k, sortedBestFirst.length))]
}

function chooseBest(category, candidates, slice, remaining, rng) {
  if (candidates.length === 0) return null

  const withinSlice = candidates.filter((p) => p.price <= slice)
  if (withinSlice.length > 0) {
    if (PERF.has(category)) {
      return pick([...withinSlice].sort((a, b) => (b.perfScore - a.perfScore) || (a.price - b.price)), rng)
    }
    return pick([...withinSlice].sort((a, b) => a.price - b.price), rng)
  }

  // Nothing this category's share of the budget can buy. Take the CHEAPEST thing
  // that still fits, not the best.
  //
  // The old fallback widened the pool to everything affordable and then, for
  // CPU/GPU, took the highest performer in it — so a £600 office build, whose
  // profile allots the graphics card about £84, bought a £429 RX 6800 XT simply
  // because it was the strongest card under `remaining`. The build then could not
  // afford the PSU that card needs and came out at 136% of budget.
  //
  // The slice is what the profile says this category is worth. Buy in, cheaply,
  // and let the score-greedy maximise pass upgrade later if the money is really
  // spare — it prices every step against the whole build, PSU included.
  const affordableNow = candidates.filter((p) => p.price <= remaining)
  if (affordableNow.length > 0) return [...affordableNow].sort((a, b) => a.price - b.price)[0]

  // Genuinely nothing fits. Return the cheapest so the caller can see the build
  // overshoot and report "budget too low" rather than silently omitting a part.
  return [...candidates].sort((a, b) => a.price - b.price)[0]
}

export function autoBuild(selectedParts, budget, partsData, resolution = '1440p', options = {}) {
  const weights = options.weights ?? weightsFor(resolution)
  const upgradeOrder = options.upgradeOrder ?? ['gpu', 'cpu']
  const maximise = options.maximise ?? false
  const rng = options.rng ?? null
  const lockExisting = options.lockExisting ?? true
  // Use case to score against. Absent, the maximise pass keeps its original
  // quality-stepping behaviour — so every existing caller is untouched.
  const rateFor = options.rateFor ?? null

  const result = { ...selectedParts }
  const userCats = lockExisting ? new Set(Object.keys(selectedParts)) : new Set()
  const spentExisting = Object.values(result).reduce((s, p) => s + (p?.price ?? 0), 0)
  const available = Math.max(0, budget - spentExisting)
  let remaining = available

  const emptyCats = FILL_ORDER.filter((c) => !result[c])
  const weightSum = emptyCats.reduce((s, c) => s + (weights[c] ?? 0), 0) || 1

  const priceOfPsuFor = psuPricer(ofCategory(partsData, 'psu'))
  const spendOf = (sel) => Object.values(sel).reduce((s, p) => s + (p?.price ?? 0), 0)
  // What this selection really costs: the parts, plus the power supply it will
  // need if one has not been chosen yet.
  const projectedTotal = (sel) => spendOf(sel) + (sel.psu ? 0 : priceOfPsuFor(sel))
  const affordable = (sel) => projectedTotal(sel) <= budget

  // The least a category can possibly be filled for. Ignores compatibility, so
  // it is a lower bound — which is what a reserve wants to be.
  const floorPrice = {}
  for (const c of FILL_ORDER) {
    const list = ofCategory(partsData, c)
    floorPrice[c] = list.length ? Math.min(...list.map((p) => p.price)) : 0
  }

  // What a CPU costs beyond its own sticker: the cheapest board that takes its
  // socket, plus the cheapest memory that board's type accepts.
  //
  // A CPU commits the whole build to a platform, and nothing here backtracks.
  // Priced on the chip alone, programming at £500 bought a £139.99 AM5 part
  // over an £84.99 LGA1700 one, then had to buy the AM5 board (£69.99) and
  // DDR5 memory (£44.99) that follow from it — where the cheaper chip would
  // have taken a £64.99 board and £29.99 of DDR4. A £55 upgrade that really
  // costs £75, on a build with £79 of headroom, is how you land over budget.
  const cheapestRamOf = {}
  for (const r of ofCategory(partsData, 'ram')) {
    if (cheapestRamOf[r.ramType] == null || r.price < cheapestRamOf[r.ramType]) {
      cheapestRamOf[r.ramType] = r.price
    }
  }
  const platformCost = (cpu) => {
    let best = Infinity
    for (const b of ofCategory(partsData, 'motherboard')) {
      if (b.socket !== cpu.socket) continue
      const ram = cheapestRamOf[b.ramType]
      if (ram != null) best = Math.min(best, b.price + ram)
    }
    return best
  }

  // Fill every empty category except PSU (sized last, after upgrades).
  //
  // Each pick keeps back enough to fill everything still unchosen, PSU
  // included. Reserving only the PSU's WEIGHT SLICE let an early category eat
  // money a later one needed, and the build then overshot a budget it could
  // genuinely have met: programming at £500 came out at 100.9% and creation at
  // £450 at 105.4%, against a cheapest-possible complete build of £421. The
  // caller then reports "not enough budget" for a budget that was enough.
  //
  // A weight slice is the wrong instrument for this because it answers "what is
  // this category worth?", not "what does the rest of the build still cost?".
  for (let i = 0; i < emptyCats.length; i++) {
    const category = emptyCats[i]
    if (category === 'psu') continue
    const slice = ((weights[category] ?? 0) / weightSum) * available
    let candidates = ofCategory(partsData, category).filter((p) => checkCompatibility(result, p).compatible)
    // compatibility.js only checks GPU-length when selecting a GPU, not a case —
    // so enforce it here when a GPU is already chosen.
    // ⚠️ Only when the length is a NUMBER. `undefined <= 400` is false, so a
    // card with no published length used to filter out every case in the
    // catalogue and leave the build with none at all.
    if (category === 'case' && typeof result.gpu?.length === 'number') {
      candidates = candidates.filter((p) => result.gpu.length <= p.maxGpuLength)
    }
    const reserve = emptyCats.slice(i + 1).reduce((s, c) => s + (floorPrice[c] ?? 0), 0)

    // Judge a CPU on chip + platform. The board and memory are reserved through
    // platformCost instead of their own floors, so they are not counted twice.
    if (category === 'cpu') {
      const others = emptyCats.slice(i + 1)
        .filter((c) => c !== 'motherboard' && c !== 'ram')
        .reduce((s, c) => s + (floorPrice[c] ?? 0), 0)
      const affordablePlatform = candidates.filter((p) => p.price + platformCost(p) <= remaining - others)
      // Only narrow if something survives — when nothing does, the build is
      // genuinely unaffordable and must still overshoot visibly so the caller
      // can say so rather than quietly shipping a part short.
      if (affordablePlatform.length > 0) candidates = affordablePlatform
    }

    const chosen = chooseBest(category, candidates, slice, remaining - reserve, rng)
    if (chosen) {
      result[category] = chosen
      remaining -= chosen.price
    }
  }

  // Affordable, compatible, strictly-better swaps for a category, cheapest first.
  const upgradePool = (category) => {
    const current = result[category]
    if (!current) return []
    const curQ = partQuality(current)
    const without = { ...result, [category]: undefined }
    let pool = ofCategory(partsData, category)
      .filter((p) => checkCompatibility(without, p).compatible)
      .filter((p) => partQuality(p) > curQ && p.price - current.price <= remaining)
    // Same gap as the fill pass: compatibility.js checks GPU length when picking
    // a GPU, never when picking the case it has to fit inside. And the same
    // guard — an unknown length must not empty the pool.
    if (category === 'case' && typeof result.gpu?.length === 'number') {
      pool = pool.filter((p) => result.gpu.length <= p.maxGpuLength)
    }
    // Capacity the use case cannot use earns no score, so never pay for it.
    if (category === 'ram' && rateFor) pool = pool.filter((p) => (p.capacityGb ?? 0) <= usefulRamGb(rateFor))
    return pool.sort((a, b) => a.price - b.price)
  }

  // Best higher-quality part in `category` we can still afford. `cheapest` picks
  // the smallest affordable step up (used by the maximise loop); otherwise the
  // best affordable jump (the original leftover behavior).
  const affordableUpgrade = (category, cheapest) => {
    const pool = upgradePool(category)
    if (pool.length === 0) return null
    const sorted = cheapest
      ? [...pool].sort((a, b) => (a.price - b.price) || (partQuality(b) - partQuality(a)))
      : [...pool].sort((a, b) => (partQuality(b) - partQuality(a)) || (a.price - b.price))
    return pick(sorted, rng)
  }

  // A handful of candidates spread across the affordable price range. Rating
  // every one of ~35 parts in every category on every round is what this cap
  // avoids; the loop iterates, so a step skipped now is still reachable next
  // round once something cheaper has been bought.
  const upgradeCandidates = (category, cap = 6) => {
    const pool = upgradePool(category)
    if (pool.length <= cap) return pool
    const out = new Set()
    for (let i = 0; i < cap; i++) out.add(pool[Math.round((i * (pool.length - 1)) / (cap - 1))])
    return [...out]
  }

  // The original maximise pass: walk the priority list taking the cheapest step
  // up in each until nothing more is affordable. Terminates because quality
  // strictly increases each step over a finite catalog.
  const stepUpQuality = () => {
    let guard = 0
    let stepped = true
    while (stepped && guard++ < 200) {
      stepped = false
      for (const category of upgradeOrder) {
        if (userCats.has(category)) continue
        const next = affordableUpgrade(category, true)
        // Priced with the power supply it drags along — see psuPricer.
        if (next && affordable({ ...result, [category]: next })) {
          remaining -= next.price - result[category].price
          result[category] = next
          stepped = true
        }
      }
    }
  }

  if (maximise && rateFor) {
    // Score-greedy maximise. Every affordable single-part swap is priced against
    // the CustomPC score it would actually buy, and the best score-per-pound one
    // wins each round.
    //
    // The old pass walked a fixed priority list taking the cheapest step up in
    // each, over and over. That has no notion of diminishing returns, so a £1700
    // gaming build marched the CPU to an i9-14900KS — £650 that bought nothing a
    // gamer would feel — while the GPU, which the profile weights nearly twice as
    // heavily, sat at 76. Rating each candidate is what makes "best within the
    // budget" mean the thing the user is shown.
    const greedy = (scoreOf, minGain) => {
      let guard = 0
      while (guard++ < 60) {
        const base = scoreOf(rateBuild(result, rateFor, partsData))
        const steps = []
        for (const category of FILL_ORDER) {
          if (category === 'psu' || userCats.has(category) || !result[category]) continue
          for (const cand of upgradeCandidates(category)) {
            const next = { ...result, [category]: cand }
            if (!affordable(next)) continue
            const cost = cand.price - result[category].price
            const gain = scoreOf(rateBuild(next, rateFor, partsData)) - base
            if (gain < minGain) continue
            steps.push({ category, cand, cost, value: cost > 0 ? gain / cost : Infinity })
          }
        }
        if (steps.length === 0) break
        // Deterministic ordering: score-per-pound, then the cheaper step, then the
        // part id — so ties never resolve on catalogue order, which shifts whenever
        // the Supabase catalogue is re-fetched.
        steps.sort((a, b) => b.value - a.value || a.cost - b.cost || (a.cand.id < b.cand.id ? -1 : 1))
        const step = pick(steps, rng, 2)
        remaining -= step.cost
        result[step.category] = step.cand
      }
    }
    greedy((r) => r.overall, Number.MIN_VALUE)
    // The pass above sees only whole points, so a cheap step in a low-weight
    // category (a better case, more fans) rounds to no gain and was never bought:
    // every gaming build up to £3,800 shipped in the cheapest case on sale. This
    // spends what is left on exact-score gains of at least MIN_GAIN - after the
    // main pass, so it can only add to the build that pass chose, never reroute
    // it, and MIN_GAIN keeps office and programming stopping when money buys
    // nothing.
    greedy((r) => r.exact, MIN_GAIN)
    // Nothing left that raises the score, so put any remainder into raw quality
    // in the profile's upgrade order (memory capped at what the use can use).
    stepUpQuality()
  } else if (maximise) {
    stepUpQuality()
  } else {
    // Spend leftover upgrading auto-picked parts (never the user's own picks).
    for (const category of upgradeOrder) {
      if (userCats.has(category)) continue
      const better = affordableUpgrade(category, false)
      // Priced with the power supply it drags along, like the maximise passes.
      if (better && affordable({ ...result, [category]: better })) {
        remaining -= better.price - result[category].price
        result[category] = better
      }
    }
  }

  // Size the PSU last, against the final draw.
  if (!result.psu) {
    const psu = choosePsu(ofCategory(partsData, 'psu'), peakDrawW(result), remaining, result)
    if (psu) {
      result.psu = psu
      remaining -= psu.price
    }
  }

  return result
}
