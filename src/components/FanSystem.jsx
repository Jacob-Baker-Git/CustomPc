import { FAN_MOUNTS, fittedFanMounts } from '../lib/fanMounts'
import { Fan, EmptyFanSlot } from './models/FanUnit'

// Renders every case fan mount: a fan on as many as the case ships with plus any
// fan pack (see fittedFanMounts), an empty square slot on the rest.
export default function FanSystem({ selectedParts }) {
  const fitted = fittedFanMounts(selectedParts)
  return (
    <group>
      {FAN_MOUNTS.map((mount, i) => (
        <group key={i} position={mount.position} rotation={mount.rotation}>
          {fitted.has(i) ? <Fan /> : <EmptyFanSlot />}
        </group>
      ))}
    </group>
  )
}
