// Per-use-case build profiles for the budget-maximizing builder. `weights`
// follows autoBuilder's slice model (need not sum to 1). `upgradeOrder` is the
// priority list the maximise pass spends leftover on. `resolution` seeds the
// build's stored resolution (changeable later in the Build tab).
export const BUILD_PROFILES = {
  gaming: {
    weights: { cpu: 0.18, gpu: 0.32, motherboard: 0.11, ram: 0.08, storage: 0.07, psu: 0.07, case: 0.08, cooler: 0.06, fans: 0.03 },
    upgradeOrder: ['gpu', 'cpu'],
    resolution: '1440p',
  },
  everyday: {
    weights: { cpu: 0.20, gpu: 0.14, motherboard: 0.11, ram: 0.10, storage: 0.14, psu: 0.08, case: 0.09, cooler: 0.08, fans: 0.06 },
    upgradeOrder: ['storage', 'cpu'],
    resolution: '1080p',
  },
  programming: {
    weights: { cpu: 0.30, gpu: 0.14, motherboard: 0.11, ram: 0.16, storage: 0.11, psu: 0.06, case: 0.06, cooler: 0.06, fans: 0.03 },
    upgradeOrder: ['cpu', 'ram', 'storage'],
    resolution: '1440p',
  },
  workstation: {
    weights: { cpu: 0.26, gpu: 0.24, motherboard: 0.11, ram: 0.14, storage: 0.09, psu: 0.07, case: 0.05, cooler: 0.06, fans: 0.03 },
    upgradeOrder: ['gpu', 'cpu', 'ram'],
    resolution: '4k',
  },
}

export const USE_CASE_LABEL = {
  gaming: 'Gaming', everyday: 'Everyday', programming: 'Programming', workstation: 'Workstation',
}

export const USE_CASES = [
  { id: 'gaming',      label: 'Gaming',      blurb: 'High frame rates in the latest games.' },
  { id: 'everyday',    label: 'Everyday',    blurb: 'Fast, quiet, great value for general use.' },
  { id: 'programming', label: 'Programming', blurb: 'Cores and memory for compiling and many tabs.' },
  { id: 'workstation', label: 'Workstation', blurb: 'Heavy CPU + GPU + RAM for rendering and editing.' },
]
