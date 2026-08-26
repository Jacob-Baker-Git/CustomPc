export const CATEGORIES = [
  { id: 'cpu',         label: 'CPU' },
  { id: 'gpu',         label: 'GPU' },
  { id: 'motherboard', label: 'Motherboard' },
  { id: 'ram',         label: 'RAM' },
  { id: 'storage',     label: 'Storage' },
  { id: 'psu',         label: 'PSU' },
  { id: 'case',        label: 'Case' },
  { id: 'cooler',      label: 'CPU Cooler' },
  { id: 'fans',        label: 'Case Fans' },
  { id: 'paste',       label: 'Thermal Paste' },
]

// Peripherals are not part of a build's budget and so are not in CATEGORIES,
// but they share the browsing and artwork machinery and need names too.
const PERIPHERAL_LABEL = {
  monitor: 'Monitor',
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  headset: 'Headset',
}

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))

// The display name for a category id.
//
// ⚠️ Use this instead of the `capitalize` CSS class, which is what four call
// sites did and which cannot know an initialism from a word: it rendered the
// part picker's heading as "Gpu" and the browser's filter chips as "Cpu",
// "Psu" and "Ram". CSS is being asked a question about language there, and it
// has no way to answer it.
export function categoryLabel(id) {
  return LABEL[id] ?? PERIPHERAL_LABEL[id] ?? (id ? id[0].toUpperCase() + id.slice(1) : '')
}
