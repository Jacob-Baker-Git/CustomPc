import { useMemo } from 'react'
import { slotSeatBox } from '../../lib/assemblyGeometry'
import { sizeOverrides } from '../../lib/partOverrides'

// The graphics card's edge filling its x16 slot, so a seated card reads as
// seated — see slotSeatBox for why the two meshes alone showed an empty slot.
export default function SlotSeat({ selectedParts }) {
  const box = useMemo(() => slotSeatBox(sizeOverrides(selectedParts)), [selectedParts])
  if (!box) return null
  const size = box.max.map((v, i) => v - box.min[i])
  const centre = box.max.map((v, i) => (v + box.min[i]) / 2)
  return (
    <mesh position={centre}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#0d0f0d" metalness={0.2} roughness={0.6} />
    </mesh>
  )
}
