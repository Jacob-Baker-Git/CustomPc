// Performance points per £100 spent — higher is better value.
export function valuePerPound(part) {
  if (!part || !part.price || !part.perfScore) return 0
  return part.perfScore / (part.price / 100)
}
