import {
  Cpu, Monitor, CircuitBoard, MemoryStick, HardDrive,
  Zap, PcCase, Snowflake, Fan, Droplets,
} from 'lucide-react'

const ICONS = {
  cpu: Cpu,
  gpu: Monitor,
  motherboard: CircuitBoard,
  ram: MemoryStick,
  storage: HardDrive,
  psu: Zap,
  case: PcCase,
  cooler: Snowflake,
  fans: Fan,
  paste: Droplets,
}

// `fallback` rather than an exported `hasCategoryIcon` predicate, which is what
// this first grew. Two reasons, and the second is the real one:
//
//   - eslint's react-refresh/only-export-components fails a component file that
//     also exports a plain function, so the predicate could not live here;
//   - and a predicate exported from somewhere else would be a second list of
//     which ids have icons, free to drift from ICONS above. Passing the
//     fallback in keeps one list.
//
// Default stays null, because every existing caller passes an id it knows and
// relies on nothing being drawn for the ones it does not.
export default function CategoryIcon({ id, size = 14, className = '', fallback: Fallback = null }) {
  const Icon = ICONS[id] ?? Fallback
  return Icon ? <Icon size={size} className={`shrink-0 ${className}`} aria-hidden="true" /> : null
}
