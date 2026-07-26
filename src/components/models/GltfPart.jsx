import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

// Loads a GLTF/GLB part and normalises it: the model is re-centred on the origin
// and uniformly scaled so its largest dimension equals `targetSize` (world
// units). This lets us drop in models of unknown native scale/pivot and have
// them land at a predictable size in the assembly. Fine positioning and
// orientation are supplied by the caller (refined against the render).
export default function GltfPart({ url, targetSize = 2, rotation = [0, 0, 0], position = [0, 0, 0] }) {
  const { scene } = useGLTF(url)

  const { object, scale } = useMemo(() => {
    const obj = scene.clone(true)
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    // Shift so the bounding-box centre sits at the origin, then the wrapping
    // group scales uniformly about that origin.
    obj.position.sub(center)
    return { object: obj, scale: targetSize / maxDim }
  }, [scene, targetSize])

  return (
    <group position={position} rotation={rotation}>
      <group scale={scale}>
        <primitive object={object} />
      </group>
    </group>
  )
}
