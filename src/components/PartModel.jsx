const GEOMETRY = {
  motherboard: [2.4, 0.05, 2.4],
  cpu:         [0.6,  0.04, 0.6],
  gpu:         [2.2,  0.1,  0.6],
  ram:         [0.15, 0.6,  0.05],
  storage:     [0.8,  0.05, 0.5],
  psu:         [0.9,  0.5,  0.6],
  case:        [1.0,  2.0,  0.5],
  cooler:      [0.5,  0.5,  0.5],
}

const COLOR = {
  motherboard: '#1a6b3c',
  cpu:         '#2a6b9c',
  gpu:         '#9c2a2a',
  ram:         '#6b2a9c',
  storage:     '#9c7a2a',
  psu:         '#2a9c6b',
  case:        '#6b6b6b',
  cooler:      '#4a9c9c',
}

const OFFSET = {
  motherboard: [0,    0,     0],
  cpu:         [0.3,  0.08, -0.3],
  gpu:         [0,   -0.5,   0.8],
  ram:         [-0.9, 0.4,  -0.5],
  storage:     [0.6, -0.1,   0.4],
  psu:         [-0.8,-0.8,   0.3],
  case:        [0,    0,     0],
  cooler:      [0.3,  0.5,  -0.3],
}

export default function PartModel({ part }) {
  const dims   = GEOMETRY[part.category] ?? [0.5, 0.5, 0.5]
  const color  = COLOR[part.category]    ?? '#555'
  const offset = OFFSET[part.category]   ?? [0, 0, 0]

  return (
    <mesh position={offset}>
      <boxGeometry args={dims} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
    </mesh>
  )
}
