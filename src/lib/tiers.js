import { useCaseBuild } from './useCaseBuilder'

// Quick-start templates: budget + intended use case. Parts are generated from
// the current catalog so the build is always the best that money can buy.
export const TIERS = [
  { id: 'budget',     label: 'Budget',     budget: 900,  useCase: 'gaming' },
  { id: 'mainstream', label: 'Mainstream', budget: 1700, useCase: 'gaming' },
  { id: 'ultimate',   label: 'Ultimate',   budget: 3800, useCase: 'workstation' },
]

export function partsForTier(tier, parts) {
  return useCaseBuild(tier.budget, tier.useCase, parts)
}
