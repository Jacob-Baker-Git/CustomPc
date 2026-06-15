import { FAN_MOUNTS, FAN_GLOW } from '../lib/fanMounts'
import { Fan, EmptyFanSlot } from './models/FanUnit'

// Renders every case fan mount: the first `count` are filled with RGB fans
// (from the selected fan pack), the rest show as empty square slots.
export default function FanSystem({ count = 0 }) {
  return (
    <group>
      {FAN_MOUNTS.map((mount, i) => (
        <group key={i} position={mount.position} rotation={mount.rotation}>
          {i < count ? <Fan glow={FAN_GLOW[i % FAN_GLOW.length]} /> : <EmptyFanSlot />}
        </group>
      ))}
    </group>
  )
}
