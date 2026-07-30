// Ranks two parts of the SAME category on a comparable "which is the upgrade"
// scale. Not a cross-category metric. Used by the whole-system upgrade scorer
// and by the use-case builder's maximise pass.

function radiatorMm(radiator) {
  const m = /(\d{2,3})/.exec(String(radiator ?? ''))
  return m ? Number(m[1]) : 0
}

// Motherboards carry no perf number, so the chipset is the ranking — it is what
// decides lane count, VRM class, memory support and how far the board can be
// pushed. Without this every board scored identically, which quietly made a
// ninth of the build unratable.
const CHIPSET_TIER = {
  X870E: 100, X670E: 96, Z890: 95, X870: 88, X670: 85, Z790: 84,
  B850: 72, B860: 70, B650E: 68, B760: 56, B650: 52,
  A620: 30, H610: 28,
}

const FAN_SIZE_MM = (size) => (/(\d{2,3})/.exec(String(size ?? '')) ? Number(/(\d{2,3})/.exec(String(size))[1]) : 0)

export function partQuality(part) {
  if (!part) return 0
  const s = part.specs ?? {}
  switch (part.category) {
    case 'cpu':
    case 'gpu':
      return part.perfScore ?? 0
    case 'ram':
      return (part.capacityGb ?? 0) * 100 + (part.speed ?? 0) / 100
    case 'storage':
      return (s.readMbps ?? 0) + (part.capacityGb ?? 0)
    case 'psu':
      return part.wattage ?? 0
    case 'cooler':
      return s.type === 'AIO' ? 300 + radiatorMm(s.radiator) : (s.height ?? 0)
    case 'motherboard':
      return CHIPSET_TIER[String(s.chipset ?? '').toUpperCase()] ?? 50
    case 'case':
      // What a case actually contributes is room: for a long card, for a tall
      // cooler, and therefore for airflow around both.
      return (part.maxGpuLength ?? 0) * 0.15 + (part.maxCoolerHeight ?? 0) * 0.25
    case 'fans':
      // Total swept area — three 120s move more air than one very good 140.
      return (s.count ?? 1) * FAN_SIZE_MM(s.size)
    default:
      return part.perfScore ?? 0
  }
}
