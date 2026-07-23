import { autoBuild } from './autoBuilder'
import { BUILD_PROFILES } from './buildProfiles'

// Budget-maximizing build for a use case: fills every category by the profile's
// weights, then spends the remainder up the profile's priority list. The
// opposite of targetBuild (which minimizes spend to hit an FPS target).
export function buildForUseCase(budget, useCase, partsData, { rng } = {}) {
  const profile = BUILD_PROFILES[useCase] ?? BUILD_PROFILES.gaming
  return autoBuild({}, budget, partsData, profile.resolution, {
    weights: profile.weights,
    upgradeOrder: profile.upgradeOrder,
    maximise: true,
    rng,
  })
}
