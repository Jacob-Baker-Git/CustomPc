// Content for the "Info" spec sheet shown by hardware part cards and peripheral
// cards. Beyond raw specs it derives context the card face can't show: what the
// part pairs with, what performance to expect, and where the numbers stop
// mattering. Kept out of the component so the .jsx exports only a component
// (react-refresh) and so this logic stays directly testable.
import { RES_GPU } from './fpsEstimate'
import { CONNECTOR_LABELS } from './specRules'

const SPEC_LABELS = {
  slotsThick: 'Slot width (slots)',
  pcieGen: 'PCIe generation',
  powerConnectors: 'Power connectors',
  adapterFrom: 'Adapter in box',
  connectors: 'Connectors',
  ramSlots: 'Memory slots',
  maxRamGb: 'Max memory (GB)',
  maxRamSpeed: 'Max memory speed (MT/s)',
  epsConnectors: 'EPS headers',
  sataPorts: 'SATA ports',
  expansionSlots: 'Expansion slots',
  ratedTdpW: 'Rated for (W)',
  radiatorMm: 'Radiator size (mm)',
  m2FormFactor: 'M.2 form factor',
  m2Sata: 'M.2 SATA support',
  cores: 'Cores',
  threads: 'Threads',
  boostClock: 'Boost clock (GHz)',
  baseClock: 'Base clock (GHz)',
  vram: 'VRAM (GB)',
  vramGb: 'VRAM (GB)',
  memType: 'Memory type',
  speedMhz: 'Speed (MT/s)',   // field name is legacy; the unit is a transfer rate
  sticks: 'Sticks',
  readMbps: 'Read speed (MB/s)',
  writeMbps: 'Write speed (MB/s)',
  size: 'Fan size',
  sizeMm: 'Fan size (mm)',
  count: 'Fans in pack',
  pack: 'Fans in pack',
  rpm: 'Max RPM',
  rgb: 'RGB',
  height: 'Height (mm)',
  efficiency: 'Efficiency',
  rating: 'Efficiency rating',
  modular: 'Modular',
  formFactor: 'Form factor',
  chipset: 'Chipset',
  type: 'Type',
}

export const RES_LABEL = { '1080p': '1080p (FHD)', '1440p': '1440p (QHD)', '4k': '4K (UHD)' }

// Above this the "far beyond what anyone plays at" line is fair comment. Most
// people play between 400 and 1600 DPI; 8000 is already several times that.
const HIGH_DPI = 8000

// ⚠️ Must cover every `switch` value in peripheralsData, or insight() falls
// through to restating the field it exists to explain. Membrane and Optical
// Linear were both missing — six of the twenty-eight keyboards — and a membrane
// board's buyer is the one most likely to be new to this. Pinned by
// specSheetCopy.test.js.
const SWITCH_FEEL = {
  Brown: 'tactile bump without the click, a quiet all-rounder',
  Red: 'linear and light, fast for gaming with no tactile feedback',
  Blue: 'clicky and loud, satisfying to type on but unpopular on voice chat',
  Tactile: 'a noticeable bump at the actuation point',
  Optical: 'light-based actuation, so faster response and no contact wear',
  'Optical Linear': 'light-based actuation with no tactile bump: the fastest common combination, and quiet with it',
  Adjustable: 'per-key actuation depth you can tune in software',
  'Hall effect': 'magnetic actuation with adjustable depth and rapid-trigger',
  Membrane: 'a rubber dome under each key rather than a mechanical switch: quieter and much cheaper, but mushier to type on and not repairable key by key',
}

const tier = (score) =>
  score >= 95 ? 'flagship' : score >= 75 ? 'high-end' : score >= 55 ? 'mid-range' : score >= 35 ? 'budget' : 'entry-level'

// One or two sentences of derived guidance per category — the part of the
// sheet that tells you something the spec table can't.
export function insight(part) {
  const s = part.specs ?? {}
  switch (part.category) {
    case 'cpu':
      return `A ${tier(part.perfScore)} ${s.cores}-core chip boosting to ${s.boostClock}GHz. ` +
        `Drops into ${part.socket} boards and draws ~${part.tdp}W under load, so pick a cooler rated for that.`
    case 'gpu': {
      // ⚠️ Not every card has a published length — see gpuLengthUnknown.test.js.
      // This sentence used to read "At undefinedmm check your case clearance".
      const fit = typeof part.length === 'number'
        ? `At ${part.length}mm check your case clearance`
        : 'Its length is not published, so measure your case first'
      return `A ${tier(part.perfScore)} card with ${s.vram}GB of ${s.memType}. ` +
        `${fit}, and budget ~${part.tdp}W of PSU headroom for it.`
    }
    case 'motherboard':
      return `${s.chipset} board for ${part.socket} CPUs, taking ${part.ramType} memory only, ` +
        `${part.formFactor} cases or larger.`
    case 'ram':
      // ⚠️ Pluralise: a single-DIMM kit read "1 sticks" until 2026-09-03. The
      // sibling reader partPages.js:145 already does this through count().
      return `${part.capacityGb}GB across ${s.sticks ?? 2} stick${(s.sticks ?? 2) === 1 ? '' : 's'} of ${part.ramType}-${part.speed}. ` +
        // MT/s, not MHz: DDR5-6000 runs a 3000 MHz clock and transfers 6000
        // mega-transfers a second. This line said MHz while the spec table
        // directly below it said MT/s, on the same card.
        (part.ramType === 'DDR5'
          ? '32GB at 5600–6000 MT/s is the current sweet spot for gaming.'
          : 'DDR4 only fits older boards, so check the motherboard RAM type.')
    case 'storage': {
      const speed = s.readMbps ?? 0
      const klass = speed >= 10000 ? 'PCIe 5.0 speeds: overkill for gaming, superb for big file work'
        : speed >= 5000 ? 'fast PCIe 4.0 NVMe, so instant level loads'
        : speed >= 2000 ? 'mainstream NVMe, plenty for a game library'
        : speed >= 400 ? 'SATA speeds: fine for games, slower to copy to'
        : 'spinning disk, cheap bulk storage; keep your OS and games on an SSD'
      return `${klass}. ${part.capacityGb >= 2000 ? 'Room for a large library.' : 'Consider 2TB if you install more than a handful of big games.'}`
    }
    case 'psu':
      return `${part.wattage}W, ${s.rating ?? 'unrated'} efficiency. ` +
        `Comfortable for builds drawing up to ~${Math.round(part.wattage * 0.7)}W. Aim to leave ~30% headroom.`
    case 'case':
      return `Fits ${(part.supportedFormFactors ?? []).join('/')} boards, GPUs to ${part.maxGpuLength}mm ` +
        `and air coolers to ${part.maxCoolerHeight}mm.`
    case 'cooler':
      return s.type === 'AIO'
        ? `${s.radiatorMm}mm liquid cooler, so it needs a matching radiator mount in the case, but no height limit. Fits ${(part.sockets ?? []).join(', ')}.`
        : `${s.height}mm tall air cooler, so check case clearance. Fits ${(part.sockets ?? []).join(', ')}.`
    case 'fans':
      return `${s.count > 1 ? `${s.count}-pack of ` : ''}${s.size} fans${s.rgb ? ' with RGB' : ''}. ` +
        'Front/bottom intake, rear/top exhaust. Slight positive pressure keeps dust down.'
    case 'paste':
      // ⚠️ amountG (the tube weight) is the paste SKU differentiator - MX-6
      // ships 4g and 8g, NT-H2 3.5g and 10g. Lead with it when present; fall
      // back to the generic sentence for a row not yet researched. `s` is
      // `part.specs ?? {}`, so a paste with no specs is safe.
      return `${s.amountG ? `${s.amountG}g tube. ` : ''}Sits between the CPU and the cooler plate. Any quality paste performs within a degree or two, and a pea-sized dot is enough.`
    case 'monitor':
      return `To make full use of ${part.refresh}Hz you need ~${part.refresh} fps at ${part.resolution}, ` +
        'the Summary tab shows whether your build keeps up.'
    case 'keyboard':
      return SWITCH_FEEL[part.switch]
        ? `${part.switch} switches: ${SWITCH_FEEL[part.switch]}.`
        : `${part.switch} switches.`
    case 'mouse':
      // The "far beyond" line is true of a 26,000 DPI gaming sensor and false of
      // the 800 DPI office mouse in the catalogue, which is squarely inside the
      // range people actually play at. Stated unconditionally it told the
      // cheapest mouse's buyer the opposite of the truth.
      return part.dpi >= HIGH_DPI
        ? `${part.dpi.toLocaleString()} max DPI, far beyond what anyone plays at; weight, shape and sensor consistency matter more.`
        : `${part.dpi.toLocaleString()} max DPI, which is inside the 400–1600 most people actually play at; weight, shape and sensor consistency matter more than the number.`
    case 'headset':
      return part.type === 'Wireless'
        ? 'Wireless: no cable snag, but one more battery to charge.'
        : 'Wired: zero latency and nothing to charge, at the cost of a cable.'
    default:
      return null
  }
}

// GPUs get expected-FPS chips per resolution (GPU-side estimate, assuming the
// CPU keeps up) so the buyer can see what the card is actually for.
export function gpuResChips(part) {
  return Object.entries(RES_GPU).map(([res, factor]) => ({
    res: RES_LABEL[res] ?? res,
    fps: Math.round((part.perfScore ?? 0) * factor),
  }))
}

// A connector map — { pcie8: 3 } — is the one non-scalar spec with a
// shopper-readable form. Everything else non-scalar (m2Slots is an array of
// objects, radiatorSupport an object of arrays) is machine-readable
// compatibility data with no honest one-line rendering.
const CONNECTOR_SPECS = new Set(['powerConnectors', 'adapterFrom', 'connectors'])

// ⚠️ Returns null to mean "do not print this row". String(v) on an object gives
// "[object Object]", which shipped on the RTX 4090's info sheet the moment its
// researched connectors landed. Omitting beats asserting something false — the
// same call as coolerCapacity 0 hiding its row instead of printing a zero.
function formatSpecValue(key, v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v !== 'object') return String(v)
  if (Array.isArray(v) || !CONNECTOR_SPECS.has(key)) return null
  const parts = Object.entries(v).map(([type, n]) => `${n}× ${CONNECTOR_LABELS[type] ?? type}`)
  return parts.length > 0 ? parts.join(', ') : null
}

export function specRows(part) {
  const rows = []
  if (part.brand) rows.push(['Brand', part.brand])
  if (part.socket) rows.push(['Socket', part.socket])
  if (part.ramType) rows.push(['RAM type', part.ramType])
  if (part.speed) rows.push(['Speed (MT/s)', String(part.speed)])
  if (part.tdp > 0) rows.push(['Power draw (TDP)', `${part.tdp}W`])
  if (part.wattage) rows.push(['Wattage', `${part.wattage}W`])
  if (part.storageType) rows.push(['Storage type', part.storageType])
  if (part.capacityGb) {
    rows.push(['Capacity', part.capacityGb >= 1000 ? `${part.capacityGb / 1000}TB` : `${part.capacityGb}GB`])
  }
  if (part.length) rows.push(['Card length', `${part.length}mm`])
  if (part.height) rows.push(['Cooler height', `${part.height}mm`])
  if (part.maxGpuLength) rows.push(['Max GPU length', `${part.maxGpuLength}mm`])
  if (part.maxCoolerHeight) rows.push(['Max cooler height', `${part.maxCoolerHeight}mm`])
  // Peripheral fields (monitors, keyboards, mice, headsets).
  if (part.resolution) rows.push(['Resolution', RES_LABEL[part.resolution] ?? part.resolution])
  if (part.refresh) rows.push(['Refresh rate', `${part.refresh}Hz`])
  if (part.switch) rows.push(['Switch type', part.switch])
  if (part.dpi) rows.push(['Max DPI', part.dpi.toLocaleString()])
  if (part.type) rows.push(['Connection', part.type])
  for (const [k, v] of Object.entries(part.specs ?? {})) {
    const value = formatSpecValue(k, v)
    if (value === null) continue
    rows.push([SPEC_LABELS[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), value])
  }
  if (part.perfScore > 0) rows.push(['Performance score', String(part.perfScore)])
  return rows
}
