// A page per catalogue part — the long-tail half of this site's search presence.
//
// Everything here is DERIVED from the catalogue. That is not a style preference:
// 540-odd generated pages carrying nothing but a name and a price are textbook
// doorway content, and Google treats a site full of them worse than a site
// without them. So each page has to answer something a spec table cannot —
// what the part fits, how many of the things it needs exist, what to put beside
// it — and every one of those answers is counted off the real catalogue rather
// than written by hand. Nothing is invented, same rule as partStats.js.

import { partStats } from './partStats'

// Thermal paste is deliberately absent. Those 15 rows carry id, name, brand and
// price and nothing else — there is no honest page to build from that, and a thin
// one would cost more than it earned. Everything else has specs worth a page.
export const PART_PAGE_CATEGORIES = [
  'cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans',
]

export const hasPartPage = (part) => !!part && PART_PAGE_CATEGORIES.includes(part.category)

export const pagedParts = (parts = []) => parts.filter(hasPartPage)

export const partPath = (part) => `/parts/${typeof part === 'string' ? part : part.id}`

// Only a bare, well-formed id. Anything else is not a part page and must fall
// through to the 404 rather than being looked up — a path segment is untrusted
// input, and `/parts/../../x` resolving to a lookup is how a route becomes a bug.
const ID = /^[a-z0-9-]+$/

export function partIdFromPath(path) {
  const trimmed = String(path ?? '').replace(/^\/+|\/+$/g, '')
  if (!trimmed.startsWith('parts/')) return null
  const rest = trimmed.slice('parts/'.length)
  return ID.test(rest) ? rest : null
}

export function partById(parts = [], id) {
  const part = parts.find((p) => p.id === id)
  return hasPartPage(part) ? part : null
}

const CATEGORY_NOUN = {
  cpu: 'processor',
  gpu: 'graphics card',
  motherboard: 'motherboard',
  ram: 'memory kit',
  storage: 'drive',
  psu: 'power supply',
  case: 'case',
  cooler: 'CPU cooler',
  fans: 'case fans',
}

const money = (v) => `£${Number(v).toFixed(2)}`
const count = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`

// The headline specs for a part, as a short phrase. Reuses partStats so a page
// can never quote a figure the rest of the app computes differently.
function specPhrase(part) {
  const bits = partStats(part)
    .filter((s) => !s.derived)
    .slice(0, 3)
    .map((s) => `${s.value}${s.unit}`.trim())
    .filter(Boolean)
  return bits.join(', ')
}

// Titles and descriptions have to be UNIQUE per part. Six pages sharing the
// root's metadata is what made hash routing worthless; 544 sharing one would be
// actively harmful. The name is unique in the catalogue (asserted by
// catalogueCompatibility.test.js), so building from it guarantees uniqueness.
export function partPageMeta(part) {
  const noun = CATEGORY_NOUN[part.category] ?? 'part'
  const title = `${part.name} | Specs, Price & Compatibility | Custom PC Builder`
  const specs = specPhrase(part)
  // "estimate", always. Prices here are curated estimates, and the terms page
  // says so — a generated page repeated 544 times is the last place to imply a
  // live retail price.
  const head = `${part.name} ${noun}${specs ? `: ${specs}` : ''}.`
  const tail = `${money(part.price)} estimate. See what it fits and build around it.`
  const description = `${head} ${tail}`
  return {
    title,
    // Trimmed to what a search result will actually show, from the front, so the
    // part's own name and specs always survive.
    description: description.length <= 160 ? description : `${description.slice(0, 157).trimEnd()}...`,
  }
}

const of = (parts, category) => parts.filter((p) => p.category === category)

// Recommended PSU headroom over a part's own draw. Matches the ~1.5x rule the
// builder's own PSU check uses so a page cannot advise something the app warns
// about.
const psuFor = (watts) => Math.ceil((watts * 1.6) / 50) * 50

// What a part works with, counted off the catalogue. Each note is
// { label, detail } — the label names the constraint, the detail answers it with
// a real number, so the page says something a spec table does not.
export function compatibilityNotes(part, parts = []) {
  const notes = []
  const add = (label, detail) => { if (detail) notes.push({ label, detail }) }
  const s = part.specs ?? {}

  switch (part.category) {
    case 'cpu': {
      const boards = of(parts, 'motherboard').filter((b) => b.socket === part.socket)
      const memory = [...new Set(boards.map((b) => b.ramType))].filter(Boolean)
      const coolers = of(parts, 'cooler').filter((c) => (c.sockets ?? []).includes(part.socket))
      add('Motherboard', `Needs the ${part.socket} socket, and ${count(boards.length, 'board')} in the catalogue have it.`)
      if (memory.length) add('Memory', `Those boards take ${memory.join(' or ')}.`)
      add('Cooling', `Draws ${part.tdp} W. ${count(coolers.length, 'cooler')} list ${part.socket} support.`)
      break
    }

    case 'gpu': {
      const cases = of(parts, 'case')
      // ⚠️ Only when the length is a number. A card whose length nobody
      // publishes used to render "undefined mm long, so it fits 0 of 59
      // cases" — which is not caution about missing data, it is a false
      // statement about the hardware. Omitting the row beats asserting that.
      if (typeof part.length === 'number') {
        const fits = cases.filter((c) => (c.maxGpuLength ?? 0) >= part.length)
        add('Case clearance', `${part.length} mm long, so it fits ${fits.length} of ${cases.length} cases.`)
      }
      add('Power supply', `Draws ${part.tdp} W; allow about ${psuFor(part.tdp)} W for the whole build.`)
      if (s.vram) add('Memory', `${s.vram} GB of ${s.memType ?? 'video memory'}.`)
      break
    }

    case 'motherboard': {
      const cpus = of(parts, 'cpu').filter((c) => c.socket === part.socket)
      const memory = of(parts, 'ram').filter((r) => r.ramType === part.ramType)
      const cases = of(parts, 'case').filter((c) => (c.supportedFormFactors ?? []).includes(part.formFactor))
      add('Processors', `${part.socket} socket, and ${count(cpus.length, 'processor')} in the catalogue fit.`)
      add('Memory', `Takes ${part.ramType}; ${count(memory.length, 'kit')} match.`)
      add('Case', `${part.formFactor} board, and ${count(cases.length, 'case')} take that size.`)
      break
    }

    case 'ram': {
      const boards = of(parts, 'motherboard').filter((b) => b.ramType === part.ramType)
      add('Motherboard', `${part.ramType}, and ${count(boards.length, 'board')} accept it.`)
      add('Capacity', `${part.capacityGb} GB${s.sticks ? ` across ${count(s.sticks, 'stick')}` : ''} at ${part.speed} MT/s.`)
      break
    }

    case 'storage': {
      const boards = of(parts, 'motherboard').length
      // ⚠️ A REGEX, matching rule 3's definition in specRules.js. This was
      // `=== 'NVMe'` and no drive has ever carried that exact value — every one
      // is typed "NVMe SSD" — so the equality was dead and all 37 NVMe drives'
      // pages said the opposite of the truth, in pre-rendered HTML, until
      // 2026-09-03. partSynergy reads the same field with a regex and was fine;
      // only the exact-match reader broke, which is why no test caught it.
      add('Motherboard', /nvme|m\.2/i.test(part.storageType ?? '')
        ? `An M.2 NVMe drive, and every one of the ${boards} boards here has a slot for it.`
        : `A ${part.storageType} drive, connected by cable rather than an M.2 slot.`)
      add('Capacity', `${part.capacityGb} GB${s.readMbps ? `, reading up to ${s.readMbps} MB/s` : ''}.`)
      break
    }

    case 'psu': {
      const cpus = of(parts, 'cpu')
      const gpus = of(parts, 'gpu')
      // How many CPU+GPU pairings this unit covers at the same 1.6x headroom the
      // builder applies. A real number beats "plenty of power for most builds".
      //
      // Counted by inverting psuFor rather than by nesting the two lists: the
      // pair fits when cpu.tdp + gpu.tdp is within the budget below, so sorting
      // the cards once and walking a pointer answers it in n log n. The nested
      // version was 6,320 iterations on every render of a power supply's page.
      const budget = (Math.floor(part.wattage / 50) * 50) / 1.6
      const gpuDraws = gpus.map((g) => g.tdp).sort((a, b) => a - b)
      let covered = 0
      for (const c of cpus) {
        // Number of cards whose draw keeps the pair inside the budget.
        let lo = 0
        let hi = gpuDraws.length
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (c.tdp + gpuDraws[mid] <= budget) lo = mid + 1
          else hi = mid
        }
        covered += lo
      }
      add('Capacity', `${part.wattage} W, enough for ${covered} of the ${cpus.length * gpus.length} processor and graphics pairings here.`)
      if (s.rating) add('Efficiency', `${s.rating}, so less of what it draws is wasted as heat.`)
      break
    }

    case 'case': {
      const gpus = of(parts, 'gpu')
      const coolers = of(parts, 'cooler')
      const cardFits = gpus.filter((g) => g.length <= (part.maxGpuLength ?? 0)).length
      const coolerFits = coolers.filter((c) => (c.specs?.height ?? 0) <= (part.maxCoolerHeight ?? 0)).length
      add('Motherboards', `Takes ${(part.supportedFormFactors ?? []).join(', ')} boards.`)
      add('Graphics cards', `Up to ${part.maxGpuLength} mm, so ${cardFits} of ${gpus.length} cards fit.`)
      add('Cooling', `Air coolers up to ${part.maxCoolerHeight} mm, so ${coolerFits} of ${coolers.length} fit.`)
      break
    }

    case 'cooler': {
      const cases = of(parts, 'case')
      const height = s.height ?? 0
      const caseFits = height ? cases.filter((c) => (c.maxCoolerHeight ?? 0) >= height).length : cases.length
      const capacity = partStats(part).find((x) => x.label === 'Cooling capacity')?.value
      add('Sockets', `Mounts on ${(part.sockets ?? []).join(', ')}.`)
      if (capacity) {
        const cpus = of(parts, 'cpu')
        const handled = cpus.filter((c) => c.tdp <= capacity).length
        add('Capacity', `Around ${capacity} W of heat, comfortable with ${handled} of the ${cpus.length} processors here.`)
      }
      add('Case clearance', s.type === 'AIO'
        ? `A ${s.radiatorMm}mm radiator needs a case with matching mounts.`
        : `${height} mm tall, so ${caseFits} of ${cases.length} cases have the clearance.`)
      break
    }

    case 'fans': {
      const area = partStats(part).find((x) => x.label === 'Total airflow area')?.value
      add('Fitment', `${count(s.count ?? 1, 'fan')} at ${s.size ?? 'standard size'}.`)
      if (area) add('Airflow', `${area} cm² of swept area in total. Area, not diameter, is what moves air.`)
      break
    }

    default:
      break
  }

  if (part.legacy) {
    add('Availability', 'Discontinued, but still worth knowing if you own one, but it is not recommended for a new build.')
  }

  return notes
}

// Sensible partners, taken from the catalogue by the same rules the builder uses.
//
// Never a discontinued part: they are excluded from autoBuild and from upgrade
// suggestions for a reason, and a generated page recommending a six-year-old card
// is exactly the misleading-price problem the terms page disclaims.
//
// Deterministic — sorted, never sampled — so a page does not reshuffle between
// visits or between a crawler's two fetches of it.
export function pairings(part, parts = [], limit = 4) {
  const live = parts.filter((p) => !p.legacy && p.id !== part.id && hasPartPage(p))
  const nearestPrice = (list) => [...list]
    .sort((a, b) => Math.abs(a.price - part.price) - Math.abs(b.price - part.price) || a.id.localeCompare(b.id))

  // Matched on the CustomPC score rather than on price: the point of a pairing is
  // that neither part holds the other back.
  const nearestScore = (list) => [...list]
    .sort((a, b) => Math.abs((a.perfScore ?? 0) - (part.perfScore ?? 0)) - Math.abs((b.perfScore ?? 0) - (part.perfScore ?? 0)) || a.id.localeCompare(b.id))

  const out = []
  const take = (list, why, n = 2) => {
    for (const p of list.slice(0, n)) out.push({ part: p, why })
  }

  switch (part.category) {
    case 'cpu': {
      take(nearestScore(of(live, 'gpu')), 'Matched so neither holds the other back')
      take(nearestPrice(of(live, 'motherboard').filter((b) => b.socket === part.socket)), `Fits the ${part.socket} socket`)
      break
    }
    case 'gpu': {
      take(nearestScore(of(live, 'cpu')), 'Matched so neither holds the other back')
      take(nearestPrice(of(live, 'psu').filter((p) => p.wattage >= psuFor(part.tdp))), 'Enough power for this card')
      break
    }
    case 'motherboard': {
      take(nearestPrice(of(live, 'cpu').filter((c) => c.socket === part.socket)), `Uses the ${part.socket} socket`)
      take(nearestPrice(of(live, 'ram').filter((r) => r.ramType === part.ramType)), `${part.ramType}, as this board needs`)
      break
    }
    case 'ram':
      take(nearestPrice(of(live, 'motherboard').filter((b) => b.ramType === part.ramType)), `Takes ${part.ramType}`)
      break
    case 'storage':
      take(nearestPrice(of(live, 'motherboard')), 'A board to plug it into')
      break
    case 'psu':
      take(nearestPrice(of(live, 'gpu').filter((g) => psuFor(g.tdp) <= part.wattage)), 'Comfortably within this unit')
      break
    case 'case':
      take(nearestPrice(of(live, 'gpu').filter((g) => g.length <= (part.maxGpuLength ?? 0))), 'Fits the length limit')
      take(nearestPrice(of(live, 'cooler').filter((c) => (c.specs?.height ?? 0) <= (part.maxCoolerHeight ?? 0))), 'Clears the side panel')
      break
    case 'cooler':
      take(nearestPrice(of(live, 'cpu').filter((c) => (part.sockets ?? []).includes(c.socket))), 'This cooler mounts on it')
      break
    case 'fans':
      take(nearestPrice(of(live, 'case')), 'Somewhere to mount them')
      break
    default:
      break
  }

  return out.slice(0, limit)
}
