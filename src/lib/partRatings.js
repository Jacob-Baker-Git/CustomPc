import { partQuality } from './partQuality'
import { computeBottleneck } from './bottleneck'
import { checkCompatibility } from './compatibility'
import { gameFps } from './gameFps'
import { BUILD_PROFILES, USE_CASE_LABEL } from './buildProfiles'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const FPS_USES = new Set(['gaming', 'streaming'])

// Percentile of a part's quality within its category across the catalog (0-100).
export function partLevel(part, catalog) {
  if (!part) return 0
  const qs = catalog.filter((p) => p.category === part.category).map(partQuality)
  if (qs.length === 0) return 0
  const min = Math.min(...qs)
  const max = Math.max(...qs)
  return max > min ? Math.round(100 * (partQuality(part) - min) / (max - min)) : 100
}
