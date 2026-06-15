import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Shared animated-RGB primitives. Each cycles through the colour wheel over time;
// `phase` (0..1) offsets a part so a build reads as a flowing rainbow rather than
// every light being the same colour at once.
const SPEED = 0.12 // hue revolutions per second

function useCyclingColor(matRef, phase) {
  useFrame(({ clock }) => {
    const m = matRef.current
    if (!m) return
    const h = (clock.elapsedTime * SPEED + phase) % 1
    m.color.setHSL(h, 1, 0.5)
    m.emissive.setHSL(h, 1, 0.5)
  })
}

export function RgbRing({ radius = 0.25, tube = 0.025, phase = 0, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const matRef = useRef()
  useCyclingColor(matRef, phase)
  return (
    <mesh position={position} rotation={rotation}>
      <torusGeometry args={[radius, tube, 12, 40]} />
      <meshStandardMaterial ref={matRef} emissiveIntensity={1.7} toneMapped={false} />
    </mesh>
  )
}

export function RgbBox({ args = [0.1, 0.1, 0.1], phase = 0, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const matRef = useRef()
  useCyclingColor(matRef, phase)
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial ref={matRef} emissiveIntensity={1.5} toneMapped={false} />
    </mesh>
  )
}
