// Per-use-case profiles for the budget-maximizing builder AND the ratings model.
// `weights` = importance (builder slices + overall-score blend). `expect` = the
// per-category level a part should reach to be "enough" for this use, on the
// same scale partLevel returns — which is floored at 25, so any `expect` at or
// below 25 means "whatever is in the catalogue will do".
// `upgradeOrder` = the maximise pass priority. `resolution` seeds stored res.
// `cpuGpuPaced` = whether the CPU/GPU bottleneck is worth scoring at all. It is
// only meaningful where the two race each other frame by frame; docking an
// office or programming build for "the GPU is waiting on the CPU" describes
// nothing anyone would ever notice.
export const BUILD_PROFILES = {
  gaming: {
    weights:      { cpu: .18, gpu: .32, motherboard: .11, ram: .08, storage: .07, psu: .07, case: .08, cooler: .06, fans: .03 },
    expect:       { cpu: 68,  gpu: 75,  motherboard: 35,  ram: 45,  storage: 40,  psu: 45,  case: 30,  cooler: 45,  fans: 30 },
    needs:        { ramGb: 16, storageGb: 1000, vram: 8 },
    upgradeOrder: ['gpu', 'cpu', 'storage', 'ram'], resolution: '1440p', cpuGpuPaced: true,
  },
  office: {
    weights:      { cpu: .20, gpu: .14, motherboard: .11, ram: .10, storage: .14, psu: .08, case: .09, cooler: .08, fans: .06 },
    expect:       { cpu: 35,  gpu: 15,  motherboard: 30,  ram: 40,  storage: 45,  psu: 35,  case: 25,  cooler: 30,  fans: 20 },
    needs:        { ramGb: 16, storageGb: 500, vram: 2 },
    upgradeOrder: ['storage', 'ram', 'cpu'], resolution: '1080p',
  },
  creation: {
    weights:      { cpu: .26, gpu: .24, motherboard: .11, ram: .14, storage: .09, psu: .07, case: .05, cooler: .06, fans: .03 },
    expect:       { cpu: 70,  gpu: 65,  motherboard: 40,  ram: 70,  storage: 60,  psu: 50,  case: 30,  cooler: 55,  fans: 30 },
    needs:        { ramGb: 32, storageGb: 2000, vram: 16 },
    upgradeOrder: ['cpu', 'gpu', 'ram', 'storage'], resolution: '4k', cpuGpuPaced: true,
  },
  programming: {
    weights:      { cpu: .30, gpu: .14, motherboard: .11, ram: .16, storage: .11, psu: .06, case: .06, cooler: .06, fans: .03 },
    expect:       { cpu: 70,  gpu: 30,  motherboard: 35,  ram: 65,  storage: 55,  psu: 40,  case: 25,  cooler: 50,  fans: 20 },
    needs:        { ramGb: 32, storageGb: 1000, vram: 4 },
    upgradeOrder: ['cpu', 'ram', 'storage'], resolution: '1440p',
  },
  streaming: {
    weights:      { cpu: .24, gpu: .28, motherboard: .10, ram: .12, storage: .08, psu: .07, case: .04, cooler: .06, fans: .03 },
    expect:       { cpu: 68,  gpu: 70,  motherboard: 35,  ram: 50,  storage: 45,  psu: 50,  case: 30,  cooler: 50,  fans: 30 },
    needs:        { ramGb: 32, storageGb: 1000, vram: 8 },
    upgradeOrder: ['gpu', 'cpu', 'ram', 'storage'], resolution: '1440p', cpuGpuPaced: true,
  },
}

export const USE_CASE_LABEL = {
  gaming: 'Gaming', office: 'Everyday & Office', creation: 'Content Creation',
  programming: 'Programming', streaming: 'Streaming',
}

export const USE_CASES = [
  { id: 'gaming',      label: 'Gaming',            blurb: 'High frame rates in the latest games.' },
  { id: 'office',      label: 'Everyday & Office', blurb: 'Browsing, docs, email and media — fast and quiet.' },
  { id: 'creation',    label: 'Content Creation',  blurb: 'Video/photo editing and rendering.' },
  { id: 'programming', label: 'Programming',       blurb: 'Compiling, VMs and dozens of tabs.' },
  { id: 'streaming',   label: 'Streaming',         blurb: 'Play and broadcast at the same time.' },
]
