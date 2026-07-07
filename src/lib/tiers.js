// Quick-start budget presets. Selecting one fills the budget and advances to
// the use-case step — the actual parts depend on the use case the user then
// picks, so £900 gaming ≠ £900 office.
export const TIERS = [
  { id: 'budget',     label: 'Entry',    budget: 900 },
  { id: 'mainstream', label: 'Mid',      budget: 1700 },
  { id: 'ultimate',   label: 'High-end', budget: 3800 },
]
