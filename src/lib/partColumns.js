import { perfPerPound, fpsPerPound, pricePerGb } from './partStats'
import { coolerCapacityW } from './partSynergy'

// The desktop part picker's spec columns, per category. Only fields the
// catalogue holds or stats derived from them (partStats) — nothing invented;
// a part without the value shows a dash. Name is always the first column and
// is not listed here.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
const str = (v) => (v == null || v === '' ? null : v)
const round = (d) => (v) => v.toFixed(d)
const unit = (u) => (v) => `${v}${u}`
const gb = (v) => (v >= 1000 ? `${v / 1000}TB` : `${v}GB`)

const price = { key: 'price', label: 'Price', numeric: true, value: (p) => num(p.price), format: (v) => `£${v.toFixed(2)}` }
const tdp = { key: 'tdp', label: 'TDP', numeric: true, value: (p) => num(p.tdp), format: unit('W') }
const perf = { key: 'perf', label: 'Perf score', numeric: true, value: (p) => num(p.perfScore) }

export function columnsFor(category, resolution) {
  switch (category) {
    case 'cpu': return [
      price, perf,
      { key: 'perfPerPound', label: 'Perf / £100', numeric: true, value: (p) => num(perfPerPound(p)), format: round(1) },
      { key: 'cores', label: 'Cores', numeric: true, value: (p) => num(p.specs?.cores) },
      { key: 'socket', label: 'Socket', numeric: false, value: (p) => str(p.socket) },
      tdp,
    ]
    case 'gpu': return [
      price, perf,
      { key: 'fpsPerPound', label: `FPS / £100 (${resolution})`, numeric: true, value: (p) => num(fpsPerPound(p, resolution)), format: round(1) },
      { key: 'vram', label: 'VRAM', numeric: true, value: (p) => num(p.specs?.vram), format: unit('GB') },
      { key: 'length', label: 'Length', numeric: true, value: (p) => num(p.length), format: unit('mm') },
      tdp,
    ]
    case 'motherboard': return [
      price,
      { key: 'socket', label: 'Socket', numeric: false, value: (p) => str(p.socket) },
      { key: 'ramType', label: 'RAM', numeric: false, value: (p) => str(p.ramType) },
      { key: 'formFactor', label: 'Form factor', numeric: false, value: (p) => str(p.formFactor) },
    ]
    case 'ram': return [
      price,
      { key: 'capacity', label: 'Capacity', numeric: true, value: (p) => num(p.capacityGb), format: gb },
      { key: 'sticks', label: 'Sticks', numeric: true, value: (p) => num(p.specs?.sticks) },
      { key: 'ramType', label: 'Type', numeric: false, value: (p) => str(p.ramType) },
      { key: 'speed', label: 'Speed', numeric: true, value: (p) => num(p.speed), format: unit(' MT/s') },
    ]
    case 'storage': return [
      price,
      { key: 'capacity', label: 'Capacity', numeric: true, value: (p) => num(p.capacityGb), format: gb },
      { key: 'type', label: 'Type', numeric: false, value: (p) => str(p.storageType) },
      { key: 'perGb', label: '£ / GB', numeric: true, value: (p) => num(pricePerGb(p)), format: (v) => `£${v.toFixed(3)}` },
    ]
    case 'psu': return [
      price,
      { key: 'wattage', label: 'Wattage', numeric: true, value: (p) => num(p.wattage), format: unit('W') },
      { key: 'rating', label: 'Efficiency', numeric: false, value: (p) => str(p.specs?.rating) },
    ]
    case 'cooler': return [
      price,
      { key: 'type', label: 'Type', numeric: false, value: (p) => str(p.specs?.type) },
      { key: 'capacity', label: 'Cooling (est.)', numeric: true, value: (p) => num(coolerCapacityW(p)), format: unit('W') },
      { key: 'height', label: 'Height', numeric: true, value: (p) => num(p.specs?.height), format: unit('mm') },
    ]
    case 'case': return [
      price,
      { key: 'maxGpu', label: 'Max GPU', numeric: true, value: (p) => num(p.maxGpuLength), format: unit('mm') },
      { key: 'maxCooler', label: 'Max cooler', numeric: true, value: (p) => num(p.maxCoolerHeight), format: unit('mm') },
      { key: 'fans', label: 'Fans in box', numeric: true, value: (p) => (typeof p.specs?.includedFans === 'number' ? p.specs.includedFans : null) },
    ]
    case 'fans': return [
      price,
      { key: 'size', label: 'Size', numeric: true, value: (p) => num(p.specs?.size), format: unit('mm') },
      { key: 'count', label: 'In pack', numeric: true, value: (p) => num(p.specs?.count) },
    ]
    case 'paste': return [
      price,
      { key: 'amount', label: 'Amount', numeric: true, value: (p) => num(p.specs?.amountG), format: unit('g') },
    ]
    default: return [price]
  }
}

export function cellText(col, part) {
  const v = col.value(part)
  if (v == null) return '—'
  return col.format ? col.format(v) : String(v)
}
