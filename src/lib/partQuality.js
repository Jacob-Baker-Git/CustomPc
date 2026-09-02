import { psuEfficiency, fanArea } from './partStats'

// Ranks two parts of the SAME category on a comparable "which is the upgrade"
// scale. Not a cross-category metric. Used by the whole-system upgrade scorer
// and by the use-case builder's maximise pass.

// Motherboards carry no perf number, so the chipset is the ranking — it is what
// decides lane count, VRM class, memory support and how far the board can be
// pushed. Without this every board scored identically, which quietly made a
// ninth of the build unratable.
// Previous-generation chipsets sit below their current-generation equivalents:
// fewer lanes, older PCIe, and in the LGA1200 B-series a locked memory
// multiplier. Without these entries every AM4/LGA1200 board fell through to the
// default 50 — which made a B450 rank above a B650 and put a ninth of any
// legacy-platform build on a made-up number.
const CHIPSET_TIER = {
  X870E: 100, X670E: 96, Z890: 95, X870: 88, X670: 85, Z790: 84,
  B850: 72, B860: 70, B650E: 68, X570: 60, B760: 56, Z590: 56, B650: 52,
  Z490: 50, B550: 48, B560: 40, B450: 32, A620: 30, B460: 30, H610: 28,
}

export function partQuality(part) {
  if (!part) return 0
  const s = part.specs ?? {}
  switch (part.category) {
    case 'cpu':
    case 'gpu':
      return part.perfScore ?? 0
    case 'ram':
      // Capacity still leads — running out of memory is a cliff, being slow is a
      // slope. But /100 made speed almost invisible: two 32GB kits 1200 MT/s
      // apart differed by 12 points out of 3200. /20 keeps capacity dominant
      // while letting speed decide between kits of the same size.
      return (part.capacityGb ?? 0) * 100 + (part.speed ?? 0) / 20
    case 'storage':
      return (s.readMbps ?? 0) + (part.capacityGb ?? 0)
    case 'psu':
      // Wattage alone rated a 750W Bronze exactly level with a 750W Platinum.
      // Efficiency is real money and real heat, so it shifts the ranking without
      // ever overturning a genuine wattage gap.
      return (part.wattage ?? 0) * (1 + (psuEfficiency(part) ?? 45) / 500)
    case 'cooler':
      // ⚠️ The researched number. This used to parse the "240mm" string with a
      // second private copy of the same regex partSynergy carried; both are
      // gone. Had the string been deleted without changing this line, every
      // AIO would have scored a flat 300 and the AIO ranking would have
      // silently collapsed - no test would have said so.
      return s.type === 'AIO' ? 300 + (s.radiatorMm ?? 0) : (s.height ?? 0)
    case 'motherboard':
      return CHIPSET_TIER[String(s.chipset ?? '').toUpperCase()] ?? 50
    case 'case':
      // What a case actually contributes is room: for a long card, for a tall
      // cooler, and therefore for airflow around both.
      return (part.maxGpuLength ?? 0) * 0.15 + (part.maxCoolerHeight ?? 0) * 0.25
    case 'fans':
      // Swept AREA, not diameter: airflow goes with the square of the radius, so
      // counting millimetres understated how much a 140 beats a 120.
      return fanArea(part) ?? 0
    default:
      return part.perfScore ?? 0
  }
}
