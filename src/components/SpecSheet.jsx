// Shared "Info" spec sheet used by hardware part cards and peripheral cards.

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

const RES_LABEL = { '1080p': '1080p (FHD)', '1440p': '1440p (QHD)', '4k': '4K (UHD)' }

const humanize = (key) =>
  SPEC_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

export function specRows(part) {
  const rows = []
  if (part.brand) rows.push(['Brand', part.brand])
  if (part.socket) rows.push(['Socket', part.socket])
  if (part.ramType) rows.push(['RAM type', part.ramType])
  if (part.tdp > 0) rows.push(['Power draw (TDP)', `${part.tdp}W`])
  if (part.wattage) rows.push(['Wattage', `${part.wattage}W`])
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
    rows.push([humanize(k), typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)])
  }
  if (part.perfScore > 0) rows.push(['Performance score', String(part.perfScore)])
  return rows
}

export default function SpecSheet({ part }) {
  return (
    <dl className="text-[11px] leading-relaxed border-t border-white/10 pt-2 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {specRows(part).map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-slate-200 text-right font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
