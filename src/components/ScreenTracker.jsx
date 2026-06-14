import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { assemblyLayout } from '../lib/assemblyLayout'
import { ndcToPixel } from '../lib/projectToScreen'
import { partScreenPositions } from '../lib/partScreenPositions'

const v = new Vector3()

export default function ScreenTracker({ selectedParts }) {
  const { camera, size } = useThree()

  useFrame(() => {
    partScreenPositions.size = { w: size.width, h: size.height }
    const next = {}
    for (const category of Object.keys(selectedParts)) {
      if (!selectedParts[category]) continue
      const { position } = assemblyLayout(category, selectedParts)
      v.set(position[0], position[1], position[2]).project(camera)
      next[category] = ndcToPixel(v.x, v.y, size.width, size.height)
    }
    partScreenPositions.positions = next
  })

  return null
}
