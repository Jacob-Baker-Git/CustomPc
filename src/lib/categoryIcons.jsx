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

export default function CategoryIcon({ id, size = 14, className = '' }) {
  const Icon = ICONS[id]
  return Icon ? <Icon size={size} className={`shrink-0 ${className}`} aria-hidden="true" /> : null
}
