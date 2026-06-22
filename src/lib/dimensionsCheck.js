// Reactive physical-fit checks. Returns rows { id, label, status: 'pass'|'fail'|'na', detail }.
export function dimensionsCheck(selectedParts = {}) {
  const { gpu, case: pcCase, cooler } = selectedParts
  const rows = []

  if (gpu && pcCase && typeof gpu.length === 'number' && typeof pcCase.maxGpuLength === 'number') {
    const pass = gpu.length <= pcCase.maxGpuLength
    rows.push({ id: 'gpu-length', label: 'GPU length vs case clearance', status: pass ? 'pass' : 'fail', detail: `${gpu.length}mm GPU / ${pcCase.maxGpuLength}mm max` })
  } else {
    rows.push({ id: 'gpu-length', label: 'GPU length vs case clearance', status: 'na', detail: 'Select a GPU and a case' })
  }

  const coolerH = cooler?.specs?.height
  const caseMax = pcCase?.maxCoolerHeight
  if (typeof coolerH === 'number' && typeof caseMax === 'number') {
    const pass = coolerH <= caseMax
    rows.push({ id: 'cooler-height', label: 'CPU cooler height vs case', status: pass ? 'pass' : 'fail', detail: `${coolerH}mm cooler / ${caseMax}mm max` })
  } else if (cooler && coolerH == null) {
    rows.push({ id: 'cooler-height', label: 'CPU cooler height vs case', status: 'na', detail: 'AIO cooler — no height limit' })
  } else {
    rows.push({ id: 'cooler-height', label: 'CPU cooler height vs case', status: 'na', detail: 'Select an air cooler and a case' })
  }

  return rows
}
