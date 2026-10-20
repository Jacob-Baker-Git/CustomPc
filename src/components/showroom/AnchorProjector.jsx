import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import useBuilderStore from '../../store/useBuilderStore'
import { SHOWROOM_SLOTS } from '../../lib/showroomSlots.js'
import { anchorWorldPoint, projectAnchor, seenThroughGlass } from '../../lib/showroom.js'

// Inside <Canvas>: projects each picked part's anchor and hands it to the
// overlay's place(). Under frameloop="demand" useFrame runs only on frames that
// actually render (OrbitControls invalidates on change), so idle costs nothing.
//
// onReady(true) fires on the first rendered frame and onReady(false) on unmount
// (including the error boundary tearing the canvas down), so the page shows the
// overlay only while there is a live canvas under it. `ready` coming back true
// is what mounts the overlay, so it triggers one more frame to place it.
export default function AnchorProjector({ overlayRef, parts, onReady, ready }) {
  const invalidate = useThree((s) => s.invalidate)
  const solidCase = useBuilderStore((s) => Boolean(s.selectedParts.case) && !s.caseTransparent)
  const told = useRef(false)
  const points = useMemo(
    () => SHOWROOM_SLOTS.filter((s) => parts?.[s.id]).map((s) => [s.id, anchorWorldPoint(s.id, parts)]),
    [parts],
  )
  useEffect(() => { invalidate() }, [invalidate, points, ready, solidCase])
  useEffect(() => () => { told.current = false; onReady?.(false) }, [onReady])

  useFrame(({ camera }) => {
    if (!told.current) { told.current = true; onReady?.(true) }
    const overlay = overlayRef?.current
    if (!overlay) return
    const eye = camera.position.toArray()
    for (const [id, world] of points) {
      const p = projectAnchor(world, camera)
      // A solid case hides everything not seen through its glass side.
      overlay.place(id, p.x, p.y, p.visible && (!solidCase || seenThroughGlass(eye, world)))
    }
  })
  return null
}
