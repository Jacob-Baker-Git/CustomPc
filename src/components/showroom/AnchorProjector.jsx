import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { SHOWROOM_SLOTS, anchorWorldPoint, projectAnchor } from '../../lib/showroom.js'

// Inside <Canvas>: projects each picked part's anchor and hands it to the
// overlay's place(). Under frameloop="demand" useFrame runs only on frames that
// actually render (OrbitControls invalidates on change), so idle costs nothing.
export default function AnchorProjector({ overlayRef, parts }) {
  const invalidate = useThree((s) => s.invalidate)
  const points = useMemo(
    () => SHOWROOM_SLOTS.filter((s) => parts?.[s.id]).map((s) => [s.id, anchorWorldPoint(s.id, parts)]),
    [parts],
  )
  // One frame after mount / a build change, so the dots land without a drag.
  useEffect(() => { invalidate() }, [invalidate, points])

  useFrame(({ camera }) => {
    const overlay = overlayRef?.current
    if (!overlay) return
    for (const [id, world] of points) {
      const p = projectAnchor(world, camera)
      overlay.place(id, p.x, p.y, p.visible)
    }
  })
  return null
}
