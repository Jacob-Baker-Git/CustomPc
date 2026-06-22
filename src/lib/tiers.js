// Curated, mutually-compatible build templates. IDs reference src/data/partsData.json.
export const TIERS = [
  {
    id: 'budget', label: 'Budget', budget: 900, resolution: '1080p',
    ids: ['cpu-ryzen-5-7600', 'mb-asrock-a620m', 'cooler-deepcool-ak400', 'ram-crucial-ddr5-16', 'gpu-rtx-4060', 'storage-crucial-p3-1tb', 'psu-msi-mag-a650', 'case-cm-q300l', 'fans-arctic-p12-max-single'],
  },
  {
    id: 'mainstream', label: 'Mainstream', budget: 1700, resolution: '1440p',
    ids: ['cpu-ryzen-7-7800x3d', 'mb-asus-b650-plus', 'cooler-deepcool-ak620', 'ram-corsair-ddr5-32', 'gpu-rtx-4070-super', 'storage-wd-sn850x-1tb', 'psu-corsair-rm750e', 'case-corsair-4000d', 'fans-arctic-p12-max-single'],
  },
  {
    id: 'ultimate', label: 'Ultimate', budget: 3800, resolution: '4k',
    ids: ['cpu-ryzen-9-7950x3d', 'mb-asus-x670e', 'cooler-noctua-d15', 'ram-gskill-ddr5-64', 'gpu-rtx-4090', 'storage-wd-sn850x-2tb', 'psu-corsair-rm1000x', 'case-fractal-meshify-2', 'fans-lian-li-sl140-2pack'],
  },
]

export function partsForTier(tier, parts) {
  const byId = new Map(parts.map((p) => [p.id, p]))
  const map = {}
  for (const id of tier.ids) {
    const p = byId.get(id)
    if (p) map[p.category] = p
  }
  return map
}
