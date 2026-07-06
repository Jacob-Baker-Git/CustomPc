// Ranks two parts of the SAME category on a comparable "which is the upgrade"
// scale. Not a cross-category metric. Used by the whole-system upgrade scorer
// and by the use-case builder's maximise pass.

function radiatorMm(radiator) {
  const m = /(\d{2,3})/.exec(String(radiator ?? ''))
  return m ? Number(m[1]) : 0
}

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
    default:
      return part.perfScore ?? 0
  }
}
