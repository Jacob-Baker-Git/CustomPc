export function checkCompatibility(selectedParts, candidate) {
  const { motherboard, case: selectedCase, cpu, ram, cooler } = selectedParts

  if (candidate.category === 'cpu' && motherboard) {
    if (candidate.socket !== motherboard.socket)
      return { compatible: false, reason: `Requires ${candidate.socket} socket — motherboard uses ${motherboard.socket}` }
  }

  if (candidate.category === 'motherboard' && cpu) {
    if (candidate.socket !== cpu.socket)
      return { compatible: false, reason: `Requires ${candidate.socket} socket — CPU uses ${cpu.socket}` }
  }

  if (candidate.category === 'ram' && motherboard) {
    if (candidate.ramType !== motherboard.ramType)
      return { compatible: false, reason: `Requires ${candidate.ramType} — motherboard supports ${motherboard.ramType} only` }
  }

  if (candidate.category === 'motherboard' && ram) {
    if (candidate.ramType !== ram.ramType)
      return { compatible: false, reason: `Requires ${candidate.ramType} — your RAM is ${ram.ramType}` }
  }

  if (candidate.category === 'case' && motherboard) {
    if (Array.isArray(candidate.supportedFormFactors) && !candidate.supportedFormFactors.includes(motherboard.formFactor))
      return { compatible: false, reason: `Does not support ${motherboard.formFactor} form factor` }
  }

  if (candidate.category === 'motherboard' && selectedCase) {
    if (Array.isArray(selectedCase.supportedFormFactors) && !selectedCase.supportedFormFactors.includes(candidate.formFactor))
      return { compatible: false, reason: `Case does not support ${candidate.formFactor} form factor` }
  }

  if (candidate.category === 'gpu' && selectedCase) {
    if (candidate.length > selectedCase.maxGpuLength)
      return { compatible: false, reason: `GPU length ${candidate.length}mm exceeds case clearance of ${selectedCase.maxGpuLength}mm` }
  }

  if (candidate.category === 'cooler' && motherboard) {
    if (Array.isArray(candidate.sockets) && !candidate.sockets.includes(motherboard.socket))
      return { compatible: false, reason: `Cooler does not support ${motherboard.socket} socket` }
  }

  if (candidate.category === 'cooler' && cpu) {
    if (Array.isArray(candidate.sockets) && !candidate.sockets.includes(cpu.socket))
      return { compatible: false, reason: `Cooler does not support ${cpu.socket} socket` }
  }

  if (candidate.category === 'cpu' && cooler) {
    if (Array.isArray(cooler.sockets) && !cooler.sockets.includes(candidate.socket))
      return { compatible: false, reason: `Selected cooler does not support ${candidate.socket} socket` }
  }

  if (candidate.category === 'motherboard' && cooler) {
    if (Array.isArray(cooler.sockets) && !cooler.sockets.includes(candidate.socket))
      return { compatible: false, reason: `Selected cooler does not support ${candidate.socket} socket` }
  }

  return { compatible: true, reason: '' }
}

export function getLockedReasons(selectedParts, allParts) {
  const reasons = {}
  for (const part of allParts) {
    const { compatible, reason } = checkCompatibility(selectedParts, part)
    if (!compatible) reasons[part.id] = reason
  }
  return reasons
}
