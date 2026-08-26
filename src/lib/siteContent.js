// When the price snapshot was taken. Lived in three components as a hardcoded
// "July 2026" that would silently rot at different rates; keep it here so the
// Summary, the footer and the Help page can never disagree about it.
export const PRICE_SNAPSHOT = 'July 2026'

// Every frame-rate figure on the site is model output, not a measurement.
// Shown as bare integers they read as a promise we can't stand behind, so this
// travels with them — the same reason prices carry a caveat in BuildSummary.
export const FPS_CAVEAT =
  'Modelled estimates, not measured benchmarks. Real frame rates vary with settings, drivers and the game version.'

// The performance engine needs its OWN caveat, because FPS_CAVEAT is a claim
// the engine contradicts. That text says nothing here is measured, which is
// true of the legacy heuristic above and false of the engine — whose report
// counts, in the line directly above this one, how many figures came from a
// real measurement. Rendering both put "3 measured directly" immediately above
// "not measured benchmarks" and made the page argue with itself.
//
// What still needs saying: even a measured figure came off somebody else's
// test bench, not this build.
//
// The quoted word has to be the one the table prints, or the caveat sends the
// reader hunting for a label that is not on the page. BASIS_LABEL renders the
// `measured` tier as "benchmarked" (and BasisBar's mix line says "N
// benchmarked"), so this quotes that — not the internal tier name.
export const PERF_CAVEAT =
  'Estimated from published benchmark measurements. Figures marked "benchmarked" come from a review of that exact combination; the rest are derived from the same data. Either way your frame rates will vary with settings, drivers, the game version and the specific scene.'

// CC BY 4.0 requires crediting the author, naming the work, linking the source
// where practicable, and stating that changes were made. Every model is scaled
// and re-oriented to the assembly's 1 wu = 122 mm scale and some have stray
// nodes hidden, so the "modified" wording on the Help page is not optional.
//
// `file` ties each credit to the mesh it covers so modelCredits.test.js can
// assert everything in public/models is actually credited — adding a model
// without a credit fails the suite instead of quietly infringing.
//
// Six of these sources were recovered by searching Sketchfab for the recorded
// author + title (2026-08-01) after the download URLs were found to have never
// been written down. Each URL was matched on BOTH author and title, and the
// titles below are now the exact Sketchfab titles rather than paraphrases.
//
// Licence: ALL EIGHT verified "CC Attribution" on their Sketchfab pages.
// gpu, storage and ram were confirmed 2026-08-01 from the retrieved listing;
// motherboard, cooler and psu on 2026-08-02 by loading the pages in a real
// browser. Sketchfab renders licence text client-side, so a plain fetch returns
// an empty page — that is why the last three sat unverified, not because there
// was any doubt. Re-check the same way if a model is ever swapped.
export const MODEL_CREDITS = [
  { file: 'cpu.glb', part: 'CPU', title: 'PC CPU processor', author: 'apleesee', source: 'https://sketchfab.com/3d-models/pc-cpu-processor-efb6b95b255c4a37a9661df178ea3bb3' },
  { file: 'fan.glb', part: 'Case fans', title: '120mm Computer Fans', author: 'kusuma844', source: 'https://sketchfab.com/3d-models/120mm-computer-fans-6c17bfc4a2a5438eb9996fb3c73e1a91' },
  { file: 'gpu.glb', part: 'Graphics card', title: 'GeForce RTX 3080 Graphics Card', author: '_surovic_', source: 'https://sketchfab.com/3d-models/geforce-rtx-3080-graphics-card-8b947ee1bf7a4e3d8ffa1c24893ac160' },
  { file: 'motherboard.glb', part: 'Motherboard', title: 'Asus Strix b-550-f Gaming Motherboard Realistic', author: 'MUSHROOM_BUILDS', source: 'https://sketchfab.com/3d-models/asus-strix-b-550-f-gaming-motherboard-realistic-3eba5f45bed74fbeb2647de38047000f' },
  { file: 'cooler.glb', part: 'CPU cooler', title: 'Liquid CPU Cooling', author: 'Denzerru', source: 'https://sketchfab.com/3d-models/liquid-cpu-cooling-7a0014c1141a4c25bc69912075526ee5' },
  { file: 'psu.glb', part: 'Power supply', title: 'PSU Power Supply Unit', author: 'Groovex', source: 'https://sketchfab.com/3d-models/psu-power-supply-unit-69ccd1be3a77497cb2acc9e39e7c52b3' },
  { file: 'storage.glb', part: 'Storage', title: 'M.2 NVME SSD Samsung 990 Pro 1TB', author: 'lime.ball.animations', source: 'https://sketchfab.com/3d-models/m2-nvme-ssd-samsung-990-pro-1tb-3d-model-41b7bfda7eab40f8b13330913fd66fc2' },
  { file: 'ram.glb', part: 'Memory', title: 'Corsairn VENGEANCE RGB PRO', author: 'Nouraiz', source: 'https://sketchfab.com/3d-models/corsairn-vengeance-rgb-pro-9b163c4d5ad34edca58488500b5f4daf' },
]

export const GLOSSARY = [
  { term: 'CPU', def: 'The processor. Runs the operating system, games logic, compilers. More cores help multitasking, rendering and compiling; high clock speed helps single-threaded work and game frame rates.' },
  { term: 'GPU', def: 'The graphics card. Renders games and accelerates video/AI work. The single biggest factor in gaming frame rates.' },
  { term: 'VRAM', def: 'Memory on the GPU. Higher resolutions, texture detail and creative workloads need more; 8GB is fine for 1080p, 16GB+ suits 4K and content creation.' },
  { term: 'TDP', def: 'Thermal Design Power (watts): roughly how much heat a part makes and power it draws. Used to size the cooler and PSU.' },
  { term: 'Socket', def: 'The physical CPU-to-motherboard connector (e.g. AM5, LGA1700). The CPU and motherboard sockets must match.' },
  { term: 'Form factor', def: 'Board/case size class: ATX (large), mATX (medium), ITX (small). The case must support the motherboard\'s form factor.' },
  { term: 'DDR4 / DDR5', def: 'RAM generations. A motherboard supports one or the other, not both, so match your RAM to the board.' },
  { term: 'NVMe SSD', def: 'The fastest common storage, plugged straight into the motherboard. Much quicker than SATA SSDs and far quicker than hard drives (HDDs).' },
  { term: 'PSU', def: 'Power supply. Should comfortably exceed the system\'s total draw. Aim for ~30% headroom. 80+ Gold/Platinum ratings mean better efficiency.' },
  { term: 'AIO', def: 'All-in-one liquid cooler. Larger radiators (240/360mm) dissipate more heat and suit high-TDP CPUs; big air coolers are a quieter, simpler alternative.' },
]

export const BUYING_TIPS = [
  { cat: 'CPU', tip: 'Match to your task: gaming favours high clocks and 6–8 strong cores; creation, programming and streaming benefit from more cores. Make sure the socket matches your motherboard.' },
  { cat: 'GPU', tip: 'Buy the most GPU your budget allows for gaming and creation. Check it physically fits your case length, and that VRAM suits your resolution.' },
  { cat: 'RAM', tip: '16GB is the floor; 32GB is the sweet spot for creation, programming and streaming. Match DDR4/DDR5 to the board and buy two sticks for dual-channel.' },
  { cat: 'Storage', tip: 'A 1TB+ NVMe SSD as the main drive is the biggest felt speed-up. Add a big HDD only for cheap bulk storage.' },
  { cat: 'PSU', tip: 'Size it above your total draw with headroom for future upgrades, and prefer an 80+ Gold or better unit from a reputable brand.' },
  { cat: 'Cooler', tip: 'Match cooling to the CPU\'s TDP. A big air tower or a 240mm+ AIO for hot chips; check air-cooler height fits the case.' },
]
