import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

// Loads a GLTF/GLB part and normalises it: the model is re-centred on the origin
// and uniformly scaled so its largest dimension equals `targetSize` (world
// units). This lets us drop in models of unknown native scale/pivot and have
// them land at a predictable size in the assembly. Fine positioning and
// orientation are supplied by the caller (refined against the render).
export default function GltfPart({ url, targetSize = 2, rotation = [0, 0, 0], position = [0, 0, 0], anchorNode }) {
  const { scene } = useGLTF(url)

  const { object, scale } = useMemo(() => {
    const obj = scene.clone(true)
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z) || 1

    // Align on the named connector when given (the AIO's pump block, say) so the
    // part meets its mount at the right point. Falls back to the bounding-box
    // centre, which is right for parts whose body IS the mounting surface.
    const anchor = anchorNode ? obj.getObjectByName(anchorNode) : null
    const centre = new THREE.Vector3()
    if (anchor) new THREE.Box3().setFromObject(anchor).getCenter(centre)
    else box.getCenter(centre)

    obj.position.sub(centre)
    return { object: obj, scale: targetSize / maxDim }
  }, [scene, targetSize, anchorNode])

  return (
    <group position={position} rotation={rotation}>
      <group scale={scale}>
        <primitive object={object} />
      </group>
    </group>
  )
}
