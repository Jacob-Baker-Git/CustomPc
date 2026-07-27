import { FAN_MOUNTS } from '../lib/fanMounts'
import { Fan, EmptyFanSlot } from './models/FanUnit'

// Renders every case fan mount. When a fan pack is selected (`filled` true)
// every mount gets a fan; otherwise each shows an empty square slot.
export default function FanSystem({ filled = false }) {
  return (
    <group>
      {FAN_MOUNTS.map((mount, i) => (
        <group key={i} position={mount.position} rotation={mount.rotation}>
          {filled ? <Fan /> : <EmptyFanSlot />}
        </group>
      ))}
    </group>
  )
}
