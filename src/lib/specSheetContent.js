// Content for the "Info" spec sheet shown by hardware part cards and peripheral
// cards. Beyond raw specs it derives context the card face can't show: what the
// part pairs with, what performance to expect, and where the numbers stop
// mattering. Kept out of the component so the .jsx exports only a component
// (react-refresh) and so this logic stays directly testable.
import { RES_GPU } from './fpsEstimate'

const SPEC_LABELS = {
  cores: 'Cores',
  threads: 'Threads',
  boostClock: 'Boost clock (GHz)',
  baseClock: 'Base clock (GHz)',
  vram: 'VRAM (GB)',
  vramGb: 'VRAM (GB)',
  memType: 'Memory type',
  speedMhz: 'Speed (MHz)',
  sticks: 'Sticks',
  readMbps: 'Read speed (MB/s)',
  writeMbps: 'Write speed (MB/s)',
  size: 'Fan size',
  sizeMm: 'Fan size (mm)',
  count: 'Fans in pack',
  pack: 'Fans in pack',
  rpm: 'Max RPM',
  rgb: 'RGB',
  radiator: 'Radiator',
  height: 'Height (mm)',
  efficiency: 'Efficiency',
  rating: 'Efficiency rating',
  modular: 'Modular',
  formFactor: 'Form factor',
  chipset: 'Chipset',
  type: 'Type',
}

export const RES_LABEL = { '1080p': '1080p (FHD)', '1440p': '1440p (QHD)', '4k': '4K (UHD)' }

const SWITCH_FEEL = {
  Brown: 'tactile bump without the click — a quiet all-rounder',
  Red: 'linear and light — fast for gaming, no tactile feedback',
  Blue: 'clicky and loud — satisfying to type on, unpopular on voice chat',
  Tactile: 'a noticeable bump at the actuation point',
  Optical: 'light-based actuation — faster response, no contact wear',
  Adjustable: 'per-key actuation depth you can tune in software',
  'Hall effect': 'magnetic actuation with adjustable depth and rapid-trigger',
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
    case 'gpu':
      return `A ${tier(part.perfScore)} card with ${s.vram}GB of ${s.memType}. ` +
        `At ${part.length}mm check your case clearance, and budget ~${part.tdp}W of PSU headroom for it.`
    case 'motherboard':
      return `${s.chipset} board for ${part.socket} CPUs — takes ${part.ramType} memory only, ` +
        `${part.formFactor} cases or larger.`
    case 'ram':
      return `${part.capacityGb}GB across ${s.sticks ?? 2} sticks of ${part.ramType}-${part.speed}. ` +
        (part.ramType === 'DDR5'
          ? '32GB at 5600–6000MHz is the current sweet spot for gaming.'
          : 'DDR4 only fits older boards — check the motherboard RAM type.')
    case 'storage': {
      const speed = s.readMbps ?? 0
      const klass = speed >= 10000 ? 'PCIe 5.0 speeds — overkill for gaming, superb for big file work'
        : speed >= 5000 ? 'fast PCIe 4.0 NVMe — instant level loads'
        : speed >= 2000 ? 'mainstream NVMe — plenty for a game library'
        : speed >= 400 ? 'SATA speeds — fine for games, slower to copy to'
        : 'spinning disk — cheap bulk storage; keep your OS and games on an SSD'
      return `${klass}. ${part.capacityGb >= 2000 ? 'Room for a large library.' : 'Consider 2TB if you install more than a handful of big games.'}`
    }
    case 'psu':
      return `${part.wattage}W, ${s.rating ?? 'unrated'} efficiency. ` +
        `Comfortable for builds drawing up to ~${Math.round(part.wattage * 0.7)}W — aim to leave ~30% headroom.`
    case 'case':
      return `Fits ${(part.supportedFormFactors ?? []).join('/')} boards, GPUs to ${part.maxGpuLength}mm ` +
        `and air coolers to ${part.maxCoolerHeight}mm.`
    case 'cooler':
      return s.type === 'AIO'
        ? `${s.radiator} liquid cooler — needs a matching radiator mount in the case, but no height limit. Fits ${(part.sockets ?? []).join(', ')}.`
        : `${s.height}mm tall air cooler — check case clearance. Fits ${(part.sockets ?? []).join(', ')}.`
    case 'fans':
      return `${s.count > 1 ? `${s.count}-pack of ` : ''}${s.size} fans${s.rgb ? ' with RGB' : ''}. ` +
        'Front/bottom intake, rear/top exhaust — slight positive pressure keeps dust down.'
    case 'paste':
      return 'Sits between the CPU and the cooler plate. Any quality paste performs within a degree or two — a pea-sized dot is enough.'
    case 'monitor':
      return `To make full use of ${part.refresh}Hz you need ~${part.refresh} fps at ${part.resolution} — ` +
        'the Summary tab shows whether your build keeps up.'
    case 'keyboard':
      return SWITCH_FEEL[part.switch]
        ? `${part.switch} switches: ${SWITCH_FEEL[part.switch]}.`
        : `${part.switch} switches.`
    case 'mouse':
      return `${part.dpi.toLocaleString()} max DPI — far beyond what anyone plays at; weight, shape and sensor consistency matter more.`
    case 'headset':
      return part.type === 'Wireless'
        ? 'Wireless — no cable snag, but one more battery to charge.'
        : 'Wired — zero latency and nothing to charge, at the cost of a cable.'
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
    rows.push([SPEC_LABELS[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)])
  }
  if (part.perfScore > 0) rows.push(['Performance score', String(part.perfScore)])
  return rows
}
