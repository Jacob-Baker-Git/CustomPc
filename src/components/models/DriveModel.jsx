import { mm } from '../../lib/pcScale'

// A 3.5" hard drive or a 2.5" SATA SSD lying flat in the basement, drawn at the
// box partOverrides gives it (world axes, centred on the origin). The M.2 stick
// keeps its GLB; this is only for the drives that GLB cannot stand in for.
export default function DriveModel({ part, size }) {
  const [sx, sy, sz] = size
  const hdd = part?.storageType === 'HDD'
  const lid = mm(hdd ? 1 : 0.6)
  return (
    <group>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={hdd ? '#9aa0a8' : '#1d1f24'} metalness={hdd ? 0.8 : 0.4} roughness={0.4} />
      </mesh>
      {/* Top label, inset from the edges. */}
      <mesh position={[0, sy / 2 + lid / 2, 0]}>
        <boxGeometry args={[sx * 0.8, lid, sz * 0.8]} />
        <meshStandardMaterial color={hdd ? '#d7dade' : '#3a3d44'} metalness={0.2} roughness={0.7} />
      </mesh>
      {/* SATA data + power connectors on the rear (-X) end. */}
      <mesh position={[-sx / 2 - mm(2), 0, 0]}>
        <boxGeometry args={[mm(4), Math.min(sy * 0.6, mm(5)), mm(30)]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  )
}
