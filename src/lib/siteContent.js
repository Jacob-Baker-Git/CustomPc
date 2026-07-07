export const GLOSSARY = [
  { term: 'CPU', def: 'The processor — runs the operating system, games logic, compilers. More cores help multitasking, rendering and compiling; high clock speed helps single-threaded work and game frame rates.' },
  { term: 'GPU', def: 'The graphics card — renders games and accelerates video/AI work. The single biggest factor in gaming frame rates.' },
  { term: 'VRAM', def: 'Memory on the GPU. Higher resolutions, texture detail and creative workloads need more; 8GB is fine for 1080p, 16GB+ suits 4K and content creation.' },
  { term: 'TDP', def: 'Thermal Design Power (watts) — roughly how much heat a part makes and power it draws. Used to size the cooler and PSU.' },
  { term: 'Socket', def: 'The physical CPU-to-motherboard connector (e.g. AM5, LGA1700). The CPU and motherboard sockets must match.' },
  { term: 'Form factor', def: 'Board/case size class — ATX (large), mATX (medium), ITX (small). The case must support the motherboard\'s form factor.' },
  { term: 'DDR4 / DDR5', def: 'RAM generations. A motherboard supports one or the other, not both — match your RAM to the board.' },
  { term: 'NVMe SSD', def: 'The fastest common storage, plugged straight into the motherboard. Much quicker than SATA SSDs and far quicker than hard drives (HDDs).' },
  { term: 'PSU', def: 'Power supply. Should comfortably exceed the system\'s total draw — aim for ~30% headroom. 80+ Gold/Platinum ratings mean better efficiency.' },
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
