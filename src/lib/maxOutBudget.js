import { autoBuild } from './autoBuilder'
import { BUILD_PROFILES } from './buildProfiles'

// Spend whatever budget is left on the best affordable, compatible upgrades to
// the CURRENT build, prioritised by the use case's upgrade order — across every
// category, not just CPU/GPU. `lockExisting: false` lets the maximise pass step
// up parts already in the build. Deterministic (best, not varied).
export function maxOutBudget(parts, budget, catalog, useCase = 'gaming') {
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  return autoBuild(parts, budget, catalog, profile.resolution, {
    weights: profile.weights,
    upgradeOrder: profile.upgradeOrder,
    maximise: true,
    lockExisting: false,
  })
}
